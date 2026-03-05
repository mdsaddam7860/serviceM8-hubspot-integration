import express from "express";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendStatus(200).send("Servers running............");
});

app.get("/health", (req, res) => {
  res.sendStatus(200).send("Servers running............");
});

// app.get("/startDualSync", (req, res) => {});

export default app;
