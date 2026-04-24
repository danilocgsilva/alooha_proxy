import express from "express";
import { request } from "undici";

const app = express();

app.use(express.raw({ type: "*/*" }));

const OLLAMA_URL = "http://host.docker.internal:11434";

type Metric = {
  path: string;
  method: string;
  // time: number;
  bytes: number;
  status: number;
};

const metrics: Metric[] = [];

app.all(/.*/, async (req: express.Request, res: express.Response) => {
  const targetUrl = `${OLLAMA_URL}${req.originalUrl}`;

  try {
    const headers = { ...req.headers };

    delete headers.host;
    delete headers["content-length"];
    delete headers.connection;

    const { body, statusCode, headers: upstreamHeaders } = await request(targetUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,
    });

    res.status(statusCode);

    for (const [key, value] of Object.entries(upstreamHeaders)) {
      if (value) res.setHeader(key, value as string);
    }

    let totalBytes = 0;

    body.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
    });

    body.on("error", (err) => {
      console.error("Stream error:", err);
      res.destroy(err);
    });

    res.on("close", () => {
      body.destroy();
    });

    body.pipe(res);

    body.on("end", () => {
      metrics.push({
        path: req.path,
        method: req.method,
        bytes: totalBytes,
        status: statusCode,
      });
    });

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Bad Gateway" });
  }
});

const portToServe: Number = 11001;

app.listen(portToServe, () => {
  console.log(`Proxy running on :${portToServe.toString()}`);
});