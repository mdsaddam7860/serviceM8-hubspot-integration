function delta() {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  return (previousDate = date.toISOString().split("T")[0]);
}
function currentDate() {
  const date = new Date();

  return date.toISOString().split("T")[0];
}

export { delta, currentDate };
