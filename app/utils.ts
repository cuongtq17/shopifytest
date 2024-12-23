import Papa from "papaparse";

type DataRow = Record<string, string | number>;

const exportToCSV = (data: DataRow[], filename: string = "data.csv"): void => {
  const csv = Papa.unparse(data);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
};

export default exportToCSV;
