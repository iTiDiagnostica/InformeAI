
interface DoctorProfile {
  name: string;
  specialty: string;
  style_directives: string;
}


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
  let lastError: Error | null = null;

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
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      console.error(`❌ Excepción al llamar a Gemini con la clave de índice ${index}:`, errObj.message);
      lastError = errObj;
    }
  }

  throw new Error(`Todas las claves API de Gemini fallaron. Último error: ${lastError?.message || 'Error desconocido'}`);
}

// ==========================================
// Integración con OpenAI (ChatGPT)
// ==========================================
async function callOpenAI(
  modelName: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OPENAI_API_KEY no está configurada. Agregue su clave API de OpenAI en el archivo .env (ej: OPENAI_API_KEY=sk-...).'
    );
  }

  // Modelos permitidos explícitamente en la configuración de límites de tu proyecto de OpenAI
  const candidateModels = Array.from(new Set([modelName, 'gpt-5.4-mini', 'gpt-5.4-nano'])).filter(Boolean);
  const url = 'https://api.openai.com/v1/chat/completions';
  let lastError = '';

  for (const targetModel of candidateModels) {
    console.log(`🤖 Enviando solicitud a OpenAI API (${targetModel})...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_completion_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('OPENAI_API_KEY inválida o expirada. Verifique su clave en https://platform.openai.com');
        }
        if (response.status === 403 || errorText.includes('does not have access to model') || errorText.includes('model_not_found')) {
          console.warn(`⚠️ El modelo '${targetModel}' no está activo o falló. Probando siguiente modelo permitido...`);
          lastError = errorText;
          continue;
        }
        throw new Error(`OpenAI API devolvió código ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        console.warn(`⚠️ OpenAI API devolvió una respuesta vacía con el modelo '${targetModel}'.`);
        lastError = 'Respuesta vacía o malformada.';
        continue;
      }

      console.log(`✅ Respuesta exitosa de OpenAI (${targetModel}).`);
      return text;
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      if (errObj.message?.includes('OPENAI_API_KEY')) throw errObj;
      console.warn(`⚠️ Error llamando a OpenAI (${targetModel}):`, errObj.message);
      lastError = errObj.message;
    }
  }

  throw new Error(`No se pudo procesar la solicitud con los modelos de OpenAI habilitados en el proyecto. Detalle: ${lastError}`);
}

// ==========================================
// Ruteador centralizado de proveedores IA
// ==========================================
async function callProvider(
  aiProvider: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = (aiProvider || 'gemini').toLowerCase();

  if (provider.includes('gemini')) {
    const modelName = provider === 'gemini' ? 'gemini-3.1-flash-lite' : aiProvider;
    return await callGeminiWithFallback(modelName, systemPrompt, userPrompt);
  } else if (provider.includes('chatgpt') || provider.includes('openai') || provider.includes('gpt')) {
    return await callOpenAI('gpt-5.4-mini', systemPrompt, userPrompt);
  } else if (provider.includes('groq')) {
    const groqModel = provider.includes('llama') ? provider.replace(/^groq-/, '') : 'llama-3.3-70b-versatile';
    const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY no está configurada en .env.');
    }
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
      throw new Error(`Groq API respondió con código ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices?.length || !data.choices[0]?.message?.content) {
      throw new Error('Groq API devolvió una respuesta vacía o malformada.');
    }
    return data.choices[0].message.content;
  } else {
    // Fallback a Gemini si el proveedor no coincide
    return await callGeminiWithFallback('gemini-3.1-flash-lite', systemPrompt, userPrompt);
  }
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
6. FORMATO MARKDOWN LIMPIO Y ESPACIADO OBLIGATORIO:
   - Usar **negrita** (doble asterisco) para el título principal y para los títulos de sección (ej: **ECOGRAFÍA MAMARIA**, **CONCLUSIÓN**).
   - OBLIGATORIO: Dejar SIEMPRE un salto de línea doble (una línea en blanco) después del título principal, antes de cada título de sección y después de cada título de sección (ej: antes y después de **CONCLUSIÓN**).
   - Separar todos los párrafos con líneas en blanco.
   - NO usar encabezados Markdown (## ###), viñetas (- * •), numeración de secciones, tabulaciones ni bloques de código.
7. NO repetir un título de sección como etiqueta dentro de su propio contenido (ej: debajo de **CONCLUSIÓN** escribir directamente el diagnóstico, sin poner "Conclusión:" ni repetir la palabra).
8. NO incluir saludos, introducciones ("Aquí está su informe"), comentarios, opiniones, explicaciones, alternativas, alertas de auditoría ni firmas. La respuesta empieza directamente con el título del estudio.
9. NO usar la palabra "clínico/a/os" en ninguna parte del reporte — es un informe de imágenes diagnósticas, no una evaluación clínica.
10. VOCABULARIO CORRECTO (RAE): Está strictly prohibido utilizar o inventar palabras. NUNCA utilices términos inexistentes en el diccionario de la Real Academia Española (RAE), neologismos o deformaciones (por ejemplo, queda TERMINANTEMENTE PROHIBIDO usar palabras inventadas que comiencen con "medidi-", tales como "medidiciones", "medidimientos", "medidición" o "medidimiento"). En su lugar, utiliza exclusivamente términos correctos y aceptados como "mediciones", "medidas" o "biometría". Toda la terminología del reporte debe ser formal, técnica y lingüísticamente correcta en español.
11. COMPATIBILIDAD CON GOOGLE DOCS: El informe final debe estructurarse de manera limpia y compatible con un bloque de Google Docs. Utiliza párrafos claros y estructurados, títulos de sección en negrita bien delimitados con líneas en blanco de separación y evita cualquier carácter especial o tabulación que rompa el copiado y pegado directo en el procesador de textos.`;

export const llmService = {
  /**
   * Toma un dictado de voz desestructurado y utiliza el contexto RAG + LLM
   * para generar un informe médico limpio y estructurado.
   */
  structureReport: async (rawText: string, context: string, doctorProfile: DoctorProfile | null = null, aiProvider: string = 'gemini'): Promise<string> => {
    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar estrictamente el siguiente estilo de redacción e instrucciones de formato personales del médico:
"${doctorProfile.style_directives}"
- ⚠️ IMPORTANTE: Utiliza las plantillas y los informes previos de este médico recuperados por el RAG como guía estricta para la terminología, estructura de órganos, expresiones típicas y formato de redacción. La devolución final debe replicar con total fidelidad cómo escribe este médico en particular sus informes de estudio de imagen.`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes. Recibes dictados médicos por voz y tu función principal es estructurarlos utilizando OBLIGATORIAMENTE la plantilla clínica oficial del médico o del sistema como base.${doctorStylePrompt}

⚠️ REGLA SUPREMA Y OBLIGATORIA — USO ESTRICTO DE PLANTILLAS DEL MÉDICO / SISTEMA (PRIORIDAD MÁXIMA PARA TODOS LOS MODELOS):
1. SIEMPRE QUE EL CONTEXTO RAG CONTENGA UNA PLANTILLA DE REFERENCIA COMPATIBLE (ej: "ECOGRAFÍA TIROIDEA CON DOPPLER", "ECOGRAFÍA MAMARIA BILATERAL", "ECOGRAFÍA ABDOMINAL", "ECOGRAFÍA OBSTÉTRICA", etc.):
   - DEBES UTILIZAR ESA PLANTILLA EXACTA COMO EL ESQUELETO Y TEXTO BASE DEL INFORME FINAL.
   - QUEDA ESTRICTAMENTE PROHIBIDO inventar una estructura propia, alucinar secciones no existentes en la plantilla o redactar descripciones estándar distintas a las de la plantilla del médico.
   - CONSERVA RIGUROSAMENTE los títulos de sección, el orden de los órganos y las descripciones normales clínicas palabra por palabra que figuran en la plantilla para todos los órganos no modificados por el dictado.
   - ÚNICAMENTE sustituye o modifica el texto de la plantilla en los órganos o estructuras específicas donde el médico haya dictado un hallazgo patológico, medida o alteración.

2. SEGURIDAD Y FIDELIDAD CLÍNICA:
   - Basarse EXCLUSIVAMENTE en lo dictado por el médico para los hallazgos patológicos. Queda ESTRICTAMENTE PROHIBIDO inventar, alucinar o asumir patologías, medidas, diagnósticos u órganos no mencionados.
   - Si el médico dicta hallazgos para un órgano, transcribirlos con fidelidad absoluta integrándolos en la sección correspondiente de la plantilla.

3. VALIDACIÓN DE COMPATIBILIDAD DE PLANTILLAS:
   - Si el contexto RAG contiene una plantilla compatible con el estudio dictado, ÚSALA OBLIGATORIAMENTE.
   - Si el contexto RAG contiene múltiples plantillas que corresponden al estudio (ej: abdominal + ginecológica), fusiónalas respetando las secciones de ambas plantillas.
   - Si la plantilla RAG no corresponde en absoluto al tipo de estudio dictado (ej. RAG incluye "ECOGRAFÍA MAMARIA" pero el dictado trata sobre "ECOGRAFÍA OBSTÉTRICA"), descarta la plantilla incompatible y estructura el informe respetando exclusivamente el estudio dictado.

4. ⚠️ OBLIGACIÓN EN DICTADOS CORTOS / SOLICITUD DE ESTUDIO (MÁXIMA PRIORIDAD PARA CHATGPT, GROQ Y GEMINI):
   - Si el dictado o entrada del usuario es únicamente el nombre de un estudio (ejemplo: "Ecografía tiroidea con doppler", "Ecografía mamaria bilateral", "Doppler renal", "Ecografía abdominal", etc.) o una solicitud breve sin hallazgos patológicos específicos:
   - DEBES DEVOLVER LA PLANTILLA COMPLETA DE ESE ESTUDIO RECUPERADA DEL RAG CON TODAS SUS SECCIONES, ÓRGANOS Y DESCRIPCIONES CLINICAS COMPLETAS.
   - Queda ESTRICTAMENTE PROHIBIDO devolver respuestas resumidas o truncadas como "Se efectuó ecografía... Conclusión: estudio solicitado" o dejar secciones vacías. Devuelve SIEMPRE el informe/plantilla COMPLETO estructurado órgano por órgano para que el médico pueda editarlo directamente.

DIRECTIVAS RADIOLÓGICAS PROFESIONALES:
- TERMINOLOGÍA ECOGRÁFICA: Usar descriptores profesionales de imagen (ecogenicidad, ecotextura, ecoestructura homogénea/heterogénea, anecoico, hipoecoico, isoecoico, hiperecoico, refuerzo acústico posterior, sombra acústica posterior, márgenes regulares/irregulares, contornos netos/difusos).
- DOPPLER: Describir patrones con terminología estándar (espectro de flujo, morfología de onda, velocidad sistólica pico, velocidad diastólica final, índice de resistencia, permeabilidad, compresibilidad, presencia/ausencia de reflujo, flujo laminar/turbulento).
- ABREVIATURAS ESTÁNDAR: Reconocer y usar correctamente DBP, CC, CA, LF, FCF, PFE, LCC, ILA, IR, IP, PSV, EDV, FEY, FEVI, DAP, DAT, TN, entre otras. No expandir abreviaturas universalmente conocidas en imagenología.
- CLASIFICACIONES: Si el médico menciona una clasificación estandarizada (BI-RADS, TI-RADS, PI-RADS, LI-RADS, Bosniak, ACR, Graf, AIUM), transcribirla fielmente con su categoría. Si no la menciona, NO inventarla.

${REGLAS_FORMATO}

FORMATO DE SALIDA:
- TÍTULO DINÁMICO: El título principal debe coincidir con el título de la plantilla RAG o reflejar el tipo de estudio específico (ej: **ECOGRAFÍA TIROIDEA CON DOPPLER**, **ECOGRAFÍA MAMARIA BILATERAL**, **ECOGRAFÍA OBSTÉTRICA — 3° TRIMESTRE**).
- Estructura de secciones con líneas en blanco obligatorias (omitir **FACTORES DE RIESGO** si no se mencionan en el dictado ni en la plantilla):

**[TÍTULO DEL TIPO DE ESTUDIO]**

[Detalle estructurado órgano por órgano replicando fielmente la plantilla RAG del médico/sistema. Hallazgos normales conservados palabra por palabra de la plantilla. Hallazgos dictados por el médico integrados con **negrita** en los puntos anatómicos clave.]

**FACTORES DE RIESGO**

[Solo si el médico los menciona o figuran en la plantilla. Párrafos limpios sin viñetas.]

**CONCLUSIÓN**

[Diagnóstico final conciso según plantilla y dictado. Incluir clasificaciones estandarizadas dictadas. Párrafo directo sin viñetas.]

Contexto de referencia (Plantillas oficiales recuperadas del RAG para este médico/sistema):
---
${context}
---`;

    const userPrompt = `Por favor estructura el siguiente dictado de voz:\n\n"${rawText}"`;
    return await callProvider(aiProvider, systemPrompt, userPrompt);
  },

  /**
   * Se le proporciona un informe médico estructurado, una instrucción de corrección
   * y el perfil del médico actual. Aplica estrictamente los cambios indicados.
   */
  correctReport: async (originalReport: string, correctionInstruction: string, doctorProfile: DoctorProfile | null = null, aiProvider: string = 'gemini'): Promise<string> => {
    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar estrictamente el siguiente estilo de redacción e instrucciones de formato personales del médico:
"${doctorProfile.style_directives}"
- ⚠️ IMPORTANTE: Mantén la terminología y las expresiones típicas del estilo de este médico durante las correcciones, asegurando que todo cambio se integre de forma natural con el resto del reporte.`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes. Se te proporciona un informe de estudio de imagen previamente generado y una instrucción de edición/corrección dictada por el médico (por voz o texto). Tu función es aplicar con total precisión las modificaciones solicitadas sobre el informe base.${doctorStylePrompt}

REGLAS DE CORRECCIÓN Y EDICIÓN POR VOZ (ESTRICTAS PARA TODOS LOS MODELOS):
1. MEMORIA Y CONTEXTO DEL INFORME: Toma el "Informe original a corregir" como contexto base. Todos los cambios solicitados por el médico deben aplicarse sobre este informe, conservando intacto todo el contenido que no haya sido afectado por la instrucción.
2. EDICIÓN DE CONTENIDO Y ESTRUCTURA: Modifica, agrega o elimina hallazgos, párrafos, medidas o secciones según la indicación explícita del médico.
3. EDICIÓN DE FORMATO, ESTILO Y ALINEACIÓN (RICHTEXT / HTML / MARKDOWN):
   - Negrita: Si el médico pide destacar o colocar palabras en negrita, usa **palabra** o <b>palabra</b>.
   - Cursiva y Subrayado: Si pide cursiva usa *palabra* y si pide subrayado usa <u>palabra</u>.
   - Alineación de texto: Si el médico pide alinear al centro, a la derecha o a la izquierda, aplica etiquetas de alineación HTML (ejemplo: <p style="text-align: center;">Texto</p>).
   - Tamaños de letra: Si el médico pide un tamaño específico (ej: 14pt, 12pt), usa etiquetas span de tamaño (ejemplo: <span style="font-size: 14pt;">Texto</span>).
   - (Nota: La familia de tipografía se mantiene fija por el sistema, pero todos los demás atributos de formato visual indicados por el médico deben aplicarse estrictamente).
4. FIDELIDAD RADIOLÓGICA: Si la edición implica modificar medidas o números, conserva siempre las unidades correspondientes (mm, cm, cc, lpm, etc.).
5. OMISIÓN DE SECCIONES VACÍAS: Si una sección queda sin contenido tras la corrección, omítela completamente.
6. RESPUESTA COMPLETA: La respuesta debe ser el informe COMPLETO actualizado en Markdown/HTML limpio, empezando directamente con el título del estudio.
7. ⚠️ DETECCIÓN DE NUEVO DICTADO COMPLETO / ESTUDIO DIFERENTE (MÁXIMA PRIORIDAD): Si la instrucción recibida no es una edición o corrección sobre el informe actual, sino un dictado médico completo para un nuevo estudio (por ejemplo, el informe actual es "ECOGRAFÍA MAMARIA" pero el texto dictado trata sobre una ecografía obstétrica, abdominal o renal completa), DEBES DESCARTAR COMPLETAMENTE el informe anterior y estructurar desde cero el nuevo informe médico formal correspondiente al nuevo dictado.

${REGLAS_FORMATO}

Informe original a corregir:
"""
${originalReport}
"""`;

    const userPrompt = `Instrucción de corrección:\n"${correctionInstruction}"\n\nPor favor, genera el informe actualizado:`;
    return await callProvider(aiProvider, systemPrompt, userPrompt);
  },

  /**
   * Toma una plantilla clínica de referencia y la transforma en una plantilla vacía
   * con campos representados por puntos suspensivos ("...") para rellenar.
   */
  generateEmptyTemplate: async (templateTitle: string, templateContent: string, doctorProfile: DoctorProfile | null = null, aiProvider: string = 'gemini'): Promise<string> => {
    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar el estilo de redacción del médico: "${doctorProfile.style_directives}"`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes. Tu tarea es tomar una plantilla de informe médico de referencia (que contiene texto con hallazgos normales y descripciones clínicas) y transformarla en una plantilla editable.

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
    return await callProvider(aiProvider, systemPrompt, userPrompt);
  },

  /**
   * Toma múltiples plantillas clínicas de referencia y las fusiona en una única plantilla vacía
   * con campos representados por puntos suspensivos ("...") para rellenar.
   */
  generateMergedEmptyTemplate: async (templates: { title: string; content: string }[], doctorProfile: DoctorProfile | null = null, aiProvider: string = 'gemini'): Promise<string> => {
    let doctorStylePrompt = '';
    if (doctorProfile) {
      doctorStylePrompt = `

⚠️ DIRECTIVAS DE ESTILO Y FORMATO DE ${doctorProfile.name.toUpperCase()} (OBLIGATORIAS):
- Especialidad del profesional: ${doctorProfile.specialty}.
- Debes aplicar el estilo de redacción del médico: "${doctorProfile.style_directives}"`;
    }

    const systemPrompt = `Eres un médico especialista en diagnóstico por imágenes. Tu tarea es tomar múltiples plantillas de informes médicos de referencia y fusionarlas en una única plantilla de informe complejo vacía (editable).

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
    return await callProvider(aiProvider, systemPrompt, userPrompt);
  }
};

