import dotenv from 'dotenv';

dotenv.config();

const LM_STUDIO_API_URL = process.env.LM_STUDIO_API_URL || 'http://host.docker.internal:1234/v1';

// ==========================================
// Rotación y Fallback de Claves API de Gemini
// ==========================================
let currentKeyIndex = 0;

function getGeminiApiKeys(): string[] {
  const keysEnv = process.env.GEMINI_API_KEYS;
  if (keysEnv) {
    const keys = keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
    if (keys.length > 0) {
      return keys;
    }
  }
  const singleKey = process.env.GEMINI_API_KEY;
  if (!singleKey || singleKey.trim() === '') {
    throw new Error('GEMINI_API_KEY no está configurada. Agregue su clave API en el archivo .env.');
  }
  return [singleKey];
}

async function callGeminiWithFallback(
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const keys = getGeminiApiKeys();
  const totalKeys = keys.length;
  let lastError: any = null;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const index = (currentKeyIndex + attempt) % totalKeys;
    const apiKey = keys[index];
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`🤖 [Intento ${attempt + 1}/${totalKeys}] Llamando a la API de Gemini con clave índice ${index}...`);

    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: userPrompt }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              { text: systemPrompt }
            ]
          },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ La clave de Gemini con índice ${index} falló con estado ${response.status}: ${errorText}`);
        lastError = new Error(`Gemini Cloud API devolvió estado ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn(`⚠️ La clave de Gemini con índice ${index} devolvió una respuesta vacía o bloqueada.`);
        lastError = new Error('Gemini Cloud API devolvió una respuesta vacía o bloqueada por políticas de seguridad.');
        continue;
      }

      console.log(`✅ Llamada a Gemini exitosa utilizando la clave con índice ${index}.`);
      currentKeyIndex = index;
      return text;
    } catch (err: any) {
      console.error(`❌ Excepción al llamar a Gemini con la clave de índice ${index}:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`Todas las claves API de Gemini fallaron. Último error: ${lastError?.message || 'Error desconocido'}`);
}


// ==========================================
// Reglas compartidas entre estructuración y corrección
// Extraídas como constante para evitar duplicación y garantizar coherencia
// ==========================================
const REGLAS_FORMATO = `REGLAS DE FORMATO Y CONTENIDO:
1. NÚMEROS EN DÍGITOS: Toda cifra (medidas, tamaños, frecuencias, edades gestacionales) se escribe con dígitos numéricos, NUNCA deletreada con palabras.
2. UNIDADES DE MEDIDA OBLIGATORIAS: Toda medición DEBE llevar su unidad según contexto:
   - Biometría fetal (DBP, CC, CA, LF, LCC, DAT): mm | Peso fetal: g o kg | FCF: lpm
   - Órganos sólidos (hígado, bazo, riñones, tiroides, próstata): mm o cm | Espesores y nódulos: mm
   - Volúmenes (próstata, residuo, líquido, quistes): ml o cc | Velocidades Doppler (PSV, EDV): cm/s
   - Edad gestacional: semanas + días (ej: "32 semanas y 4 días") | Índices (IR, IP, S/D, ILA): adimensionales
   - Dimensiones múltiples separar con "×" (ej: 45 × 32 × 28 mm). NUNCA dejar un número de medida sin unidad.
3. LATERALIDAD OBLIGATORIA: Todo hallazgo unilateral DEBE especificar derecho/izquierdo. Hallazgos simétricos indicar "bilateral".
4. LOCALIZACIÓN ANATÓMICA PRECISA: Usar nomenclatura estandarizada según región:
   - Mama: cuadrantes (CSE, CSI, CIE, CII), retroareolar, unión de cuadrantes, prolongación axilar.
   - Hígado: segmentos de Couinaud (I-VIII). Riñón: polo superior, tercio medio, polo inferior.
   - Tiroides: lóbulo derecho/izquierdo, istmo, tercio superior/medio/inferior del lóbulo.
5. PUNTUACIÓN Y SÍMBOLOS DICTADOS: Palabras de puntuación o símbolos dictados como "coma", "punto", "dos puntos", "punto y coma", "entre paréntesis", "barra" (reemplazar por el símbolo "/") o "guion" (reemplazar por el símbolo "-") que sean instrucciones del dictado → reemplazar por el signo correspondiente (ej: "grado de madurez 1 barra 2" o "grado de madurez 1 barra 2 de grannum" → "grado de madurez 1/2" o "grado de madurez I/II"). Distinguir de términos médicos ("estado de coma" = médico, "placenta anterior coma" = puntuación).
6. FORMATO MARKDOWN LIMPIO:
   - Usar **negrita** (doble asterisco) para títulos de sección y puntos anatómicos clave evaluados.
   - Separar párrafos con líneas en blanco.
   - NO usar encabezados Markdown (## ###), viñetas (- * •), numeración de secciones, tabulaciones ni bloques de código.
7. NO repetir un título de sección como etiqueta dentro de su propio contenido (ej: debajo de **CONCLUSIÓN** escribir directamente el diagnóstico, sin poner "Conclusión:" ni repetir la palabra).
8. NO incluir saludos, introducciones ("Aquí está su informe"), comentarios, opiniones, explicaciones, alternativas, alertas de auditoría ni firmas. La respuesta empieza directamente con el título del estudio.
9. NO usar la palabra "clínico/a/os" en ninguna parte del reporte — es un informe de imágenes diagnósticas, no una evaluación clínica.
10. VOCABULARIO CORRECTO (RAE): Está estrictamente prohibido utilizar o inventar palabras. NUNCA utilices términos inexistentes en el diccionario de la Real Academia Española (RAE), neologismos o deformaciones (por ejemplo, queda TERMINANTEMENTE PROHIBIDO usar palabras inventadas que comiencen con "medidi-", tales como "medidiciones", "medidimientos", "medidición" o "medidimiento"). En su lugar, utiliza exclusivamente términos correctos y aceptados como "mediciones", "medidas" o "biometría". Toda la terminología del reporte debe ser formal, técnica y lingüísticamente correcta en español.
11. COMPATIBILIDAD CON GOOGLE DOCS: El informe final debe estructurarse de manera limpia y compatible con un bloque de Google Docs. Utiliza párrafos claros y estructurados, títulos de sección en negrita bien delimitados y evita cualquier carácter especial o tabulación que rompa el copiado y pegado directo en el procesador de textos.`;

export const llmService = {
  /**
   * Toma un dictado de voz desestructurado y utiliza el contexto RAG + Gemma
   * para generar un informe médico limpio y estructurado.
   */
  structureReport: async (rawText: string, context: string, doctorProfile: any = null, aiProvider: string = 'gemma'): Promise<string> => {
    const url = `${LM_STUDIO_API_URL}/chat/completions`;

    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar estrictamente el siguiente estilo de redacción e instrucciones de formato personales del médico:
"${doctorProfile.style_directives}"
- ⚠️ IMPORTANTE: Utiliza las plantillas y los informes previos de este médico recuperados por el RAG como guía estricta para la terminología, estructura de órganos, expresiones típicas y formato de redacción. La devolución final debe replicar con total fidelidad cómo escribe este médico en particular sus informes de estudio de imagen.`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes de "Imagen Diagnóstica". Recibes dictados médicos por voz y los transformas en informes de estudio de imagen formales, objetivos y profesionales.${doctorStylePrompt}

SEGURIDAD (REGLA DE ORO — PRIORIDAD MÁXIMA):
- Basarse EXCLUSIVAMENTE en lo dictado por el médico. PROHIBIDO inventar, alucinar o asumir patologías, medidas, diagnósticos u órganos no mencionados.
- Si el médico dicta hallazgos para un órgano, transcribirlos con fidelidad absoluta.
- Para órganos no mencionados por el médico: usar las descripciones normales de la plantilla de referencia RAG (si disponible). Si no hay plantilla, incluir solo lo dictado.

INTEGRACIÓN CON PLANTILLAS RAG:
1. El bloque de contexto contiene plantillas o informes reales del RAG. Usarlos como base estructural y terminológica del reporte final.
2. CONSERVAR estructura completa de la plantilla: si describe órganos en estado normal (ej: Hígado de contornos regulares, Vesícula biliar de paredes finas) y el dictado no menciona anomalías para esas estructuras, mantener las descripciones normales.
3. REEMPLAZO QUIRÚRGICO: Integrar con precisión absoluta todos los hallazgos patológicos, medidas y alteraciones dictadas por el médico, sustituyendo la descripción normal del órgano correspondiente.
4. Adaptar terminología, expresiones y estilo de redacción de la plantilla de referencia al informe final.
5. FUSIÓN DE PLANTILLAS MÚLTIPLES: Si el contexto RAG contiene múltiples plantillas de referencia (ej. una de ecografía abdominal y otra de ecografía ginecológica) y el dictado clínico cubre hallazgos correspondientes a ambas, debes fusionar las plantillas en un único informe integrado y cohesivo. Crea un título principal unificado en la primera línea (ej. **ECOGRAFÍA ABDOMINAL Y ECOGRAFÍA GINECOLÓGICA**), organiza los órganos y secciones de ambas plantillas de manera lógica y secuencial, e integra los hallazgos dictados por el médico en las secciones respectivas. Conserva las descripciones normales de ambas plantillas para los órganos no mencionados. Finaliza con una única sección de **CONCLUSIÓN** unificada al final.

DIRECTIVAS RADIOLÓGICAS PROFESIONALES:
- TERMINOLOGÍA ECOGRÁFICA: Usar descriptores profesionales de imagen (ecogenicidad, ecotextura, ecoestructura homogénea/heterogénea, anecoico, hipoecoico, isoecoico, hiperecoico, refuerzo acústico posterior, sombra acústica posterior, márgenes regulares/irregulares, contornos netos/difusos).
- DOPPLER: Describir patrones con terminología estándar (espectro de flujo, morfología de onda, velocidad sistólica pico, velocidad diastólica final, índice de resistencia, permeabilidad, compresibilidad, presencia/ausencia de reflujo, flujo laminar/turbulento).
- ABREVIATURAS ESTÁNDAR: Reconocer y usar correctamente DBP, CC, CA, LF, FCF, PFE, LCC, ILA, IR, IP, PSV, EDV, FEY, FEVI, DAP, DAT, TN, entre otras. No expandir abreviaturas universalmente conocidas en imagenología.
- CLASIFICACIONES: Si el médico menciona una clasificación estandarizada (BI-RADS, TI-RADS, PI-RADS, LI-RADS, Bosniak, ACR, Graf, AIUM), transcribirla fielmente con su categoría. Si no la menciona, NO inventarla.

${REGLAS_FORMATO}

FORMATO DE SALIDA:
- TÍTULO DINÁMICO: El título principal del informe debe reflejar el tipo de estudio específico, inferido del dictado y/o la plantilla RAG (ej: **ECOGRAFÍA MAMARIA BILATERAL**, **ECOGRAFÍA OBSTÉTRICA — 2° TRIMESTRE**, **DOPPLER VENOSO DE MIEMBROS INFERIORES**, **ECOGRAFÍA ABDOMINAL**). Usar **INFORME** solo si el tipo de estudio no se puede determinar.
- Estructura de secciones (omitir **FACTORES DE RIESGO** si no se mencionan en el dictado):

**[TÍTULO DEL TIPO DE ESTUDIO]**
[Detalle estructurado órgano por órgano según plantilla RAG. Hallazgos normales conservados de la plantilla. Anomalías dictadas por el médico integradas con **negrita** en los puntos anatómicos clave.]

**FACTORES DE RIESGO**
[Solo si el médico los menciona. Párrafos limpios sin viñetas.]

**CONCLUSIÓN**
[Diagnóstico final conciso y preciso. Incluir clasificaciones estandarizadas si el médico las dictó. Párrafo directo sin viñetas.]

Contexto de referencia (plantillas y ejemplos RAG):
---
${context}
---`;

    const userPrompt = `Por favor estructura el siguiente dictado de voz:\n\n"${rawText}"`;

    if (aiProvider === 'gemini' || aiProvider.startsWith('gemini')) {
      try {
        console.log(`🤖 Enviando solicitud de estructuración a Gemini Cloud API...`);
        const modelName = aiProvider === 'gemini' ? 'gemini-3.1-flash-lite' : aiProvider;
        const text = await callGeminiWithFallback(modelName, systemPrompt, userPrompt);
        console.log('✅ Informe estructurado exitosamente por Gemini.');
        return text;
      } catch (error: any) {
        console.error('❌ Error al comunicarse con Gemini para estructuración:', error);
        throw new Error(`Error en el servicio de nube Gemini: ${error.message || 'Verifique su conexión a internet.'}`);
      }
    } else if (aiProvider.startsWith('groq-')) {
      try {
        const groqModel = aiProvider.substring(5); // Quitar prefijo 'groq-'
        console.log(`🤖 Enviando solicitud de estructuración a Groq API (${groqModel})...`);
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq API responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('Groq API devolvió una respuesta vacía o malformada.');
        }
        const text = data.choices[0].message.content;
        console.log('✅ Informe estructurado exitosamente por Groq.');
        return text;
      } catch (error: any) {
        console.error('❌ Error al comunicarse con Groq para estructuración:', error);
        throw new Error(`Error en el servicio Groq: ${error.message || 'Verifique su conexión a internet.'}`);
      }
    } else {
      try {
        console.log(`🤖 Enviando solicitud de estructuración a LM Studio (${url})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'loaded-model',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1, // Reducido a 0.1 para máxima precisión y mínimo de alucinaciones
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LM Studio responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('LM Studio devolvió una respuesta vacía o malformada. Verifique que el modelo esté cargado correctamente.');
        }
        const structuredReport = data.choices[0].message.content;
        console.log('✅ Informe estructurado exitosamente en formato Markdown compatible.');
        return structuredReport;
      } catch (error) {
        console.error('❌ Error al comunicarse con LM Studio para estructuración:', error);
        throw new Error('No se pudo conectar con el servicio local de AI. Asegúrese de que LM Studio esté activo en el puerto 1234.');
      }
    }
  },

  /**
   * Se le proporciona un informe médico estructurado, una instrucción de corrección
   * y el perfil del médico actual. Aplica estrictamente los cambios indicados.
   */
  correctReport: async (originalReport: string, correctionInstruction: string, doctorProfile: any = null, aiProvider: string = 'gemma'): Promise<string> => {
    const url = `${LM_STUDIO_API_URL}/chat/completions`;

    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar estrictamente el siguiente estilo de redacción e instrucciones de formato personales del médico:
"${doctorProfile.style_directives}"
- ⚠️ IMPORTANTE: Mantén la terminología y las expresiones típicas del estilo de este médico durante las correcciones, asegurando que todo cambio se integre de forma natural con el resto del reporte.`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes de "Imagen Diagnóstica". Se te proporciona un informe de estudio de imagen ya estructurado y una instrucción de corrección dictada por voz por el médico. Aplica los cambios de forma quirúrgica y precisa.${doctorStylePrompt}

REGLAS DE CORRECCIÓN (ESTRICTAS):
1. Modificar EXCLUSIVAMENTE el fragmento anatómico o sección afectada por la instrucción. NO alterar, reordenar ni reescribir el resto del informe.
2. NO inventar ni añadir información que no esté en la instrucción de corrección ni en el informe original.
3. Mantener el formato, estilo, terminología y estructura del informe original intactos.
4. Si la corrección implica agregar o cambiar una medida, incluir siempre la unidad correspondiente según contexto anatómico.
5. Si una sección queda sin contenido tras la corrección (ej: Factores de Riesgo), omitirla completamente (título y contenido).
6. La respuesta debe ser el informe COMPLETO actualizado, empezando directamente con el título del estudio.

${REGLAS_FORMATO}

Informe original a corregir:
"""
${originalReport}
"""`;

    const userPrompt = `Instrucción de corrección:\n"${correctionInstruction}"\n\nPor favor, genera el informe actualizado:`;

    if (aiProvider === 'gemini' || aiProvider.startsWith('gemini')) {
      try {
        console.log(`🤖 Enviando solicitud de corrección a Gemini Cloud API...`);
        const modelName = aiProvider === 'gemini' ? 'gemini-3.1-flash-lite' : aiProvider;
        const text = await callGeminiWithFallback(modelName, systemPrompt, userPrompt);
        console.log('✅ Informe corregido exitosamente por Gemini.');
        return text;
      } catch (error: any) {
        console.error('❌ Error al comunicarse con Gemini para corrección:', error);
        throw new Error(`Error en el servicio de nube Gemini: ${error.message || 'Verifique su conexión a internet.'}`);
      }
    } else if (aiProvider.startsWith('groq-')) {
      try {
        const groqModel = aiProvider.substring(5); // Quitar prefijo 'groq-'
        console.log(`🤖 Enviando solicitud de corrección a Groq API (${groqModel})...`);
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq API responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('Groq API devolvió una respuesta vacía o malformada.');
        }
        const text = data.choices[0].message.content;
        console.log('✅ Informe corregido exitosamente por Groq.');
        return text;
      } catch (error: any) {
        console.error('❌ Error al comunicarse con Groq para corrección:', error);
        throw new Error(`Error en el servicio Groq: ${error.message || 'Verifique su conexión a internet.'}`);
      }
    } else {
      try {
        console.log(`🤖 Enviando solicitud de corrección a LM Studio (${url})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'loaded-model',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1, // Temperatura mínima para evitar alucinaciones y mantener fidelidad al original
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LM Studio respondió con código ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('LM Studio devolvió una respuesta vacía o malformada durante la corrección.');
        }
        const updatedReport = data.choices[0].message.content;
        console.log('✅ Informe corregido exitosamente en formato Markdown compatible.');
        return updatedReport;
      } catch (error) {
        console.error('❌ Error al comunicarse con LM Studio para corrección:', error);
        throw new Error('No se pudo conectar con el servicio local de AI para aplicar la corrección.');
      }
    }
  },

  /**
   * Toma una plantilla clínica de referencia y la transforma en una plantilla vacía
   * con campos representados por puntos suspensivos ("...") para rellenar.
   */
  generateEmptyTemplate: async (templateTitle: string, templateContent: string, doctorProfile: any = null, aiProvider: string = 'gemma'): Promise<string> => {
    const url = `${LM_STUDIO_API_URL}/chat/completions`;

    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar el estilo de redacción del médico: "${doctorProfile.style_directives}"`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes de "Imagen Diagnóstica". Tu tarea es tomar una plantilla de informe médico de referencia (que contiene texto con hallazgos normales y descripciones clínicas) y transformarla en una plantilla editable.

REGLAS DE GENERACIÓN DE LA PLANTILLA EDITABLE (ESTRICTAS):
1. CONSERVA TODO EL TEXTO DESCRIPTIVO: Mantén intacta toda la información clínica, frases, descripciones detalladas de normalidad (o hallazgos) y conclusiones de la plantilla de referencia. Está PROHIBIDO reemplazar descripciones de texto o frases completas (como "de contornos regulares y ecoestructura conservada", "sin evidencia de líquido libre", etc.) con puntos suspensivos o vaciar las secciones.
2. REEMPLAZA ÚNICAMENTE VALORES NUMÉRICOS, MEDIDAS Y DIMENSIONES: Reemplaza con puntos suspensivos ("...") exclusivamente los números o valores numéricos correspondientes a dimensiones, tamaños, medidas y volúmenes de los órganos o estructuras evaluadas.
3. PRESERVA LAS UNIDADES DE MEDIDA: Mantén las unidades de medida (como "mm", "cm", "cc", "ml", "lpm", "semanas y ... días", etc.) inmediatamente después de los puntos suspensivos.
4. Conserva exactamente la estructura de secciones y órganos (títulos en **negrita**, sin viñetas, sin guiones al inicio de los párrafos, sin números de sección) de la plantilla de referencia.
5. Toda la plantilla resultante debe estar en español y con formato Markdown limpio, compatible con Google Docs.
6. Empieza directamente con el título del estudio en **negrita** (ej: **ECOGRAFÍA ABDOMINAL**).
7. NO incluyas introducciones, explicaciones, saludos ni comentarios. Solo devuelve la plantilla modificada.

Ejemplos de conversión:

Ejemplo 1 (Medidas simples y compuestas):
- Entrada:
  **ECOGRAFÍA RENAL**
  **Riñón Derecho**: de ubicación normal, mide 105 x 45 mm. Espesor del parénquima de 15 mm. No se observan imágenes de litiasis.
  **Riñón Izquierdo**: de ubicación normal, mide 110 x 48 mm. Espesor del parénquima de 16 mm.
- Salida:
  **ECOGRAFÍA RENAL**
  **Riñón Derecho**: de ubicación normal, mide ... x ... mm. Espesor del parénquima de ... mm. No se observan imágenes de litiasis.
  **Riñón Izquierdo**: de ubicación normal, mide ... x ... mm. Espesor del parénquima de ... mm.

Ejemplo 2 (Obstétrica y ginecológica):
- Entrada:
  **ECOGRAFÍA TRANSVAGINAL**
  **Útero**: en AVF, de tamaño conservado, mide 72 x 38 x 45 mm.
  **Endometrio**: de aspecto trilaminar, mide 8 mm.
  **Ovario derecho**: de caracteres normales, mide 28 x 14 mm.
  **FCF**: 140 lpm.
  **Conclusión**: Ecografía ginecológica transvaginal normal.
- Salida:
  **ECOGRAFÍA TRANSVAGINAL**
  **Útero**: en AVF, de tamaño conservado, mide ... x ... x ... mm.
  **Endometrio**: de aspecto trilaminar, mide ... mm.
  **Ovario derecho**: de caracteres normales, mide ... x ... mm.
  **FCF**: ... lpm.
  **Conclusión**: Ecografía ginecológica transvaginal normal.

${doctorStylePrompt}`;

    const userPrompt = `Título de la plantilla: ${templateTitle}\n\nContenido original de la plantilla:\n"""\n${templateContent}\n"""\n\nPor favor, genera la plantilla vacía con puntos suspensivos ("...") para rellenar:`;

    if (aiProvider === 'gemini' || aiProvider.startsWith('gemini')) {
      try {
        console.log(`🤖 Generando plantilla vacía con Gemini Cloud API...`);
        const modelName = aiProvider === 'gemini' ? 'gemini-3.1-flash-lite' : aiProvider;
        const text = await callGeminiWithFallback(modelName, systemPrompt, userPrompt);
        return text;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla vacía con Gemini:', error);
        throw new Error(`Error en el servicio de nube Gemini: ${error.message}`);
      }
    } else if (aiProvider.startsWith('groq-')) {
      try {
        const groqModel = aiProvider.substring(5);
        console.log(`🤖 Generando plantilla vacía con Groq API (${groqModel})...`);
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq API responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('Groq API devolvió una respuesta vacía o malformada.');
        }
        return data.choices[0].message.content;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla vacía con Groq:', error);
        throw new Error(`Error en el servicio Groq: ${error.message}`);
      }
    } else {
      try {
        console.log(`🤖 Generando plantilla vacía con LM Studio...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'loaded-model',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LM Studio responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('LM Studio devolvió una respuesta vacía o malformada.');
        }
        return data.choices[0].message.content;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla vacía con LM Studio:', error);
        throw new Error(`Error en LM Studio: ${error.message}`);
      }
    }
  },

  /**
   * Toma múltiples plantillas clínicas de referencia y las fusiona en una única plantilla vacía
   * con campos representados por puntos suspensivos ("...") para rellenar.
   */
  generateMergedEmptyTemplate: async (templates: { title: string; content: string }[], doctorProfile: any = null, aiProvider: string = 'gemma'): Promise<string> => {
    const url = `${LM_STUDIO_API_URL}/chat/completions`;

    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar el estilo de redacción del médico: "${doctorProfile.style_directives}"`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes de "Imagen Diagnóstica". Tu tarea es tomar múltiples plantillas de informes médicos de referencia y fusionarlas en una única plantilla de informe complejo vacía (editable).

REGLAS DE FUSIÓN Y EN BLANCO (ESTRICTAS):
1. COMBINA LOS TÍTULOS: Genera un único título principal en negrita en la primera línea que combine de forma clara y formal todos los estudios fusionados (ej. "**ECOGRAFÍA ABDOMINAL Y ECOGRAFÍA GINECOLÓGICA**", o "**ECOGRAFÍA DE ABDOMEN Y PELVIS**").
2. CONSERVA LA ESTRUCTURA COMPLETA: Incluye todas las secciones y órganos de las diferentes plantillas. Agrupa las secciones de forma ordenada y anatómica (por ejemplo, primero abdomen superior: hígado, vesícula, riñones; luego pelvis: útero, ovarios, vejiga).
3. CONSERVA LAS DESCRIPCIONES DE TEXTO: Mantén intactas todas las frases descriptivas detalladas de normalidad. Está PROHIBIDO resumir o eliminar texto clínico.
4. REEMPLAZA ÚNICAMENTE NÚMEROS Y MEDIDAS POR PUNTOS SUSPENSIVOS: Reemplaza con puntos suspensivos ("...") exclusivamente los valores numéricos correspondientes a dimensiones, tamaños, pesos y volúmenes, manteniendo sus respectivas unidades (mm, cm, cc, ml, semanas y ... días, etc.) inmediatamente después.
5. ÚNICA CONCLUSIÓN UNIFICADA: En lugar de tener múltiples secciones de conclusión, crea una única sección de **CONCLUSIÓN** al final con puntos suspensivos ("...") o espacio para el diagnóstico unificado de todos los estudios.
6. Sigue las directivas de formato y estilo del médico si están disponibles.
7. Formato Markdown limpio y compatible con Google Docs (títulos de sección en negrita, sin viñetas, sin guiones al inicio de los párrafos). No incluyas saludos ni comentarios, empieza directamente con el título en la primera línea.

${doctorStylePrompt}`;

    const templatesText = templates.map((t, idx) => `Plantilla ${idx + 1}: ${t.title}\n"""\n${t.content}\n"""`).join('\n\n');
    const userPrompt = `Por favor, fusiona las siguientes plantillas y genera la versión editable vacía con puntos suspensivos:\n\n${templatesText}`;

    if (aiProvider === 'gemini' || aiProvider.startsWith('gemini')) {
      try {
        console.log(`🤖 Generando plantilla fusionada vacía con Gemini Cloud API...`);
        const modelName = aiProvider === 'gemini' ? 'gemini-3.1-flash-lite' : aiProvider;
        const text = await callGeminiWithFallback(modelName, systemPrompt, userPrompt);
        return text;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla fusionada con Gemini:', error);
        throw new Error(`Error en el servicio de nube Gemini: ${error.message}`);
      }
    } else if (aiProvider.startsWith('groq-')) {
      try {
        const groqModel = aiProvider.substring(5);
        console.log(`🤖 Generando plantilla fusionada vacía con Groq API (${groqModel})...`);
        const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Groq API responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('Groq API devolvió una respuesta vacía o malformada.');
        }
        return data.choices[0].message.content;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla fusionada con Groq:', error);
        throw new Error(`Error en el servicio Groq: ${error.message}`);
      }
    } else {
      try {
        console.log(`🤖 Generando plantilla fusionada vacía con LM Studio...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'loaded-model',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 3000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LM Studio responded with status code ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.length || !data.choices[0]?.message?.content) {
          throw new Error('LM Studio devolvió una respuesta vacía o malformada.');
        }
        return data.choices[0].message.content;
      } catch (error: any) {
        console.error('❌ Error al generar plantilla fusionada con LM Studio:', error);
        throw new Error(`Error en LM Studio: ${error.message}`);
      }
    }
  }
};
