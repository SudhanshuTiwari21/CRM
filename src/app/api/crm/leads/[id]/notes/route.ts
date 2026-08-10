import { auth } from "@/lib/auth";
import { leadNoteSchema } from "@/lib/validators/lead";
import { addLeadNote, getLeadById } from "@/lib/services/lead.service";
import { handleApiError, jsonOk, jsonError } from "@/lib/api-utils";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const lead = await getLeadById(id);
    if (!lead) return jsonError("Lead not found", 404);
    return jsonOk({ notes: lead.notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return jsonError("Unauthorized", 401);

    const { id } = await params;
    const body = await request.json();
    const data = leadNoteSchema.parse(body);
    const note = await addLeadNote(id, data, session.user.id);
    return jsonOk(note, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
