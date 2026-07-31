import cors from "cors";
import express from "express";
import "dotenv/config";
import router from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/logger.middleware";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use("/api", router);

app.use((_request, response) => {
  response.status(404).json({ error: "Rota não encontrada" });
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Oxetech Helpdesk API running on http://localhost:${port}`);
});