import { NextResponse } from 'next/server';


// export async function POST(req: Request) {
//   const { token } = await req.json();

//   const user = await prisma.user.findFirst({
//     where: {
//       verificationToken: token,
//       tokenExpires: { gt: new Date() },
//     },
//   });

//   if (!user) {
//     return NextResponse.json({ error: 'Token invalid' }, { status: 400 });
//   }

//   await prisma.user.update({
//     where: { id: user.id },
//     data: {
//       verified: true,
//       verificationToken: null,
//       tokenExpires: null,
//     },
//   });

//   return NextResponse.json({ success: true });
// }