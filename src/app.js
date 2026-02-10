import express from "express";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servers running on PORT:${process.env.PORT}");
});

// endpoints or url fro application can be added here

export { app };
