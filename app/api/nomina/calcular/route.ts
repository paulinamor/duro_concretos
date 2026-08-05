import { NextRequest, NextResponse } from "next/server";
import { calcularNomina, type EntradaNomina } from "@/lib/nomina/calcular";

export async function POST(req: NextRequest) {
  try {
    const body: EntradaNomina = await req.json();

    if (!body.salarioDiario || body.salarioDiario <= 0) {
      return NextResponse.json({ error: "salarioDiario requerido y mayor a 0" }, { status: 400 });
    }
    if (!body.diasTrabajados || body.diasTrabajados <= 0) {
      return NextResponse.json({ error: "diasTrabajados requerido y mayor a 0" }, { status: 400 });
    }
    if (!body.periodicidad) {
      return NextResponse.json({ error: "periodicidad requerida" }, { status: 400 });
    }

    const resultado = calcularNomina(body);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("[nomina/calcular]", err);
    return NextResponse.json({ error: "Error al calcular nómina" }, { status: 500 });
  }
}
