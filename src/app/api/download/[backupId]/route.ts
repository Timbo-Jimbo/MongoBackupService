"use server"

import { validAuthOrRedirect } from "@actions/utils";
import { database } from "@backend/db";
import { backups } from "@backend/db/backup.schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";

export async function GET(
  request: Request,
  { params }: { params: { backupId: number } }
) {

  validAuthOrRedirect();

  const backup = await database.query.backups.findFirst({ where: eq(backups.id, params.backupId) });

  if (!backup) {
    redirect('/404');
  }
  else{
    const archiveFile = backup.archivePath;

    try {
      const stats = await stat(archiveFile);
      const fileStream = createReadStream(archiveFile);

      const headers = new Headers();
      headers.set('Content-Type', 'application/octet-stream');
      headers.set('Content-Disposition', `attachment; filename="${basename(archiveFile)}"`);
      headers.set('Content-Length', stats.size.toString());

      return new Response(fileStream as any, {
        headers: headers,
        status: 200,
      });
    } catch (error) {
      console.error('Error streaming file:', error);
      return Response.json({ message: "Error streaming file" }, { status: 500 });
    }
  }
}