import { getAllUserProfiles, upsertDocument, COLLECTIONS, type Notificacion } from "./db";

export async function notificarAutorizadores({
  solicitudId,
  titulo,
  detalle,
  planta,
}: {
  solicitudId: string;
  titulo: string;
  detalle: string;
  planta?: string;
}): Promise<void> {
  const allUsers = await getAllUserProfiles();
  const autorizadores = allUsers.filter((u) => u.canAuthorize && u.status === "Activo");
  if (autorizadores.length === 0) return;
  await Promise.all(
    autorizadores.map((u) => {
      const notifId = `notif_autorizacion_${solicitudId}_${u.id}`;
      const notif: Omit<Notificacion, "id"> = {
        titulo,
        detalle,
        href: "/configuracion?tab=autorizaciones",
        tag: "Autorización",
        tipo: "autorizacion",
        prioridad: "alta",
        destinatarioEmail: u.email,
        leidoPor: [],
        creadoEn: new Date().toISOString(),
        ...(planta ? { planta } : {}),
      };
      return upsertDocument(COLLECTIONS.notificaciones, notifId, notif);
    }),
  );
}
