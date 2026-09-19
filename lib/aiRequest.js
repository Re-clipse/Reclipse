import { supabaseFromRequest } from '@/lib/supabaseServer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export class RequestError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function requireAIUser(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new RequestError('Please log in to continue.', 401);
  try {
    const { data, error } = await supabaseFromRequest(request).auth.getUser(token);
    if (error?.status >= 500) throw new RequestError('Login verification is unavailable. Please try again.', 503);
    if (error || !data?.user) throw new RequestError('Please log in again to continue.', 401);
    return data.user;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Login verification is unavailable. Please try again.', 503);
  }
}

export async function readNotes(request, minimum, maximum) {
  let body;
  try { body = await request.json(); } catch {
    throw new RequestError('Please send valid notes.', 400);
  }
  if (typeof body?.text !== 'string' || body.text.trim().length < minimum) {
    throw new RequestError('Please provide a few sentences of notes to work with.', 400);
  }
  return body.text.slice(0, maximum);
}

const budgets = {
  generation: { env: 'DAILY_GENERATION_LIMIT', default: 5, label: 'study-set generation' },
  image: { env: 'DAILY_IMAGE_LIMIT', default: 10, label: 'photo reading' },
  syllabus: { env: 'DAILY_SYLLABUS_LIMIT', default: 5, label: 'syllabus parsing' },
};

export async function reserveAIUsage(userId, operation) {
  const budget = budgets[operation];
  const limit = budget && Number(process.env[budget.env] ?? budget.default);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) {
    throw new RequestError('AI usage limits are not configured. Please try again later.', 503);
  }
  let result;
  try {
    result = await supabaseAdmin().rpc('reserve_ai_usage', {
      p_user_id: userId, p_operation: operation, p_limit: limit,
    });
  } catch {
    throw new RequestError('Unable to check AI usage. Please try again later.', 503);
  }
  if (result.error || typeof result.data !== 'boolean') {
    throw new RequestError('Unable to check AI usage. Please try again later.', 503);
  }
  if (!result.data) {
    throw new RequestError(`You've reached today's ${budget.label} limit (${limit} attempts). It resets at midnight UTC.`, 429);
  }
  // Count reservations, including failed/ambiguous provider calls: never refund
  // a timeout that may already have incurred a charge, or allow unbounded retries.
}

export function aiErrorResponse(error) {
  if (error instanceof RequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: 'The AI service could not complete this request. Please try again later.' }, { status: 502 });
}
