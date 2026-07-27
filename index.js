import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const SISTEMA = `Eres un asistente clínico que transcribe recetas médicas a datos estructurados.
Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional, sin markdown y sin backticks, con esta forma exacta:
{
  "medico": "string o null",
  "paciente": "string o null",
  "fecha": "string o null",
  "medicamentos": [
    {
      "nombre": "string",
      "dosis": "string",
      "momentos": ["manana", "tarde", "noche"],
      "duracion_dias": "number o null",
      "indicaciones": "string o null"
    }
  ],
  "citas": [
    {
      "motivo": "string",
      "fecha": "string o null",
      "hora": "string o null",
      "lugar": "string o null"
    }
  ],
  "notas_generales": "string o null"
}
Si algún dato no aparece, usa null.
No inventes medicamentos, dosis, frecuencias ni fechas.
Si la imagen no es una receta médica legible, devuelve {"error":"La receta no es suficientemente legible"}.`;

function obtenerClienteAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const error = new Error("ANTHROPIC_API_KEY no está configurada en Railway");
    error.status = 503;
    error.publicMessage = "El servidor no tiene configurada la clave de Claude.";
    throw error;
  }

  return new Anthropic({ apiKey });
}

function extraerJson(texto) {
  if (!texto || typeof texto !== "string") {
    throw new Error("Claude no devolvió texto");
  }

  const limpio = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(limpio);
  } catch {
    const inicio = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");

    if (inicio >= 0 && fin > inicio) {
      return JSON.parse(limpio.slice(inicio, fin + 1));
    }

    throw new Error("Claude devolvió una respuesta que no es JSON válido");
  }
}

function mensajePublico(error) {
  if (error?.publicMessage) return error.publicMessage;

  const status = Number(error?.status || error?.statusCode || 500);
  const mensaje = String(error?.message || "").toLowerCase();

  if (status === 400) return "La imagen enviada no es válida.";
  if (status === 401) return "La clave API de Claude es inválida o fue revocada.";
  if (status === 402 || mensaje.includes("credit") || mensaje.includes("billing")) {
    return "La cuenta de Anthropic no tiene créditos disponibles.";
  }
  if (status === 403) return "La cuenta no tiene permiso para usar este modelo.";
  if (status === 404) return `El modelo ${MODEL} no está disponible para esta cuenta.`;
  if (status === 413) return "La imagen es demasiado grande.";
  if (status === 429) return "Se alcanzó temporalmente el límite de uso de Claude.";
  if (status >= 500 && status < 600) return "El servicio de Claude está temporalmente no disponible.";

  return "No se pudo procesar la receta.";
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    servicio: "plan-salud-backend",
    modelo: MODEL,
    apiKeyConfigurada: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    modelo: MODEL,
    apiKeyConfigurada: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

app.post("/api/leer-receta", async (req, res) => {
  try {
    const { imagen, mediaType = "image/jpeg" } = req.body || {};

    if (!imagen || typeof imagen !== "string") {
      return res.status(400).json({ error: "Falta la imagen." });
    }

    const tiposPermitidos = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!tiposPermitidos.has(mediaType)) {
      return res.status(400).json({
        error: "Formato de imagen no compatible. Usa JPG, PNG, WEBP o GIF.",
      });
    }

    const anthropic = obtenerClienteAnthropic();

    const respuesta = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1400,
      temperature: 0,
      system: SISTEMA,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imagen,
              },
            },
            {
              type: "text",
              text: "Transcribe esta receta médica al JSON solicitado. Si una palabra no se distingue, indícalo en notas_generales y no inventes información.",
            },
          ],
        },
      ],
    });

    const texto = respuesta.content
      .filter((bloque) => bloque.type === "text")
      .map((bloque) => bloque.text)
      .join("\n");

    const parsed = extraerJson(texto);
    return res.json(parsed);
  } catch (error) {
    const statusOriginal = Number(error?.status || error?.statusCode || 500);
    const statusRespuesta = statusOriginal >= 400 && statusOriginal <= 599
      ? statusOriginal
      : 500;

    console.error("ERROR AL PROCESAR RECETA:", {
      message: error?.message,
      status: error?.status,
      type: error?.error?.type,
      requestId: error?.request_id || error?.requestId,
      details: error?.error,
    });

    return res.status(statusRespuesta).json({
      error: mensajePublico(error),
    });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`Modelo configurado: ${MODEL}`);
  console.log(`API key configurada: ${Boolean(process.env.ANTHROPIC_API_KEY)}`);
});
