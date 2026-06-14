import { NextRequest, NextResponse } from "next/server";
import { suppressByUnsubscribe, verifyUnsubscribeToken } from "@/lib/mail/unsubscribe";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new NextResponse("Invalid unsubscribe link", { status: 400 });
  }
  await suppressByUnsubscribe(email);
  return new NextResponse("You have been unsubscribed.", { status: 200 });
}
