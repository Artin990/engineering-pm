import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/swagger";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
