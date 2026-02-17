function delta() {
  const date = new Date();
  date.setDate(date.getDate() - 9);

  const previousDate = date.toISOString().split("T")[0];
  return previousDate;
}
function currentDate() {
  const date = new Date();

  return date.toISOString().split("T")[0];
}

export { delta, currentDate };
