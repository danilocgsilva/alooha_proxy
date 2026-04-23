import express from "express";
import { request } from "undici";

const app = express();

app.use(express.raw({ type: "*/*" }));

const OLLAMA_URL = "http://ollama:11434";

type Metric = {
  path: string;
  method: string;
  time: number;
  bytes: number;
  status: number;
};

const metrics: Metric[] = [];

app.all("*", async (req, res) => {
  if (req.path === "/metrics") {
    return res.json(metrics);
  }

  const start = Date.now();

  const targetUrl = `${OLLAMA_URL}${req.originalUrl}`;

  const { body, statusCode, headers } = await request(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: undefined, // avoid forwarding host
    },
    body: req.body,
  });

  res.status(statusCode);

  for (const [key, value] of Object.entries(headers)) {
    if (value) res.setHeader(key, value as string);
  }

  let totalBytes = 0;

  // Stream data
  body.on("data", (chunk: Buffer) => {
    totalBytes += chunk.length;
  });

  body.pipe(res);

  body.on("end", () => {
    const elapsed = Date.now() - start;

    metrics.push({
      path: req.path,
      method: req.method,
      time: elapsed,
      bytes: totalBytes,
      status: statusCode,
    });
  });
});

app.listen(8000, () => {
  console.log("Proxy running on :8000");
});