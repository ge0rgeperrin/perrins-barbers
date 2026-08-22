/**
 * POST /api/booking/reserve
 *
 * The only call in the whole product with a real-world side effect: it puts an
 * appointment in the shop's diary. Two rules follow from that.
 *
 *   1. Validate here as well as in the form. The client's validation is for
 *      manners; this one is the trust boundary.
 *   2. Never report success we are not certain of. Schedulista answers a booking
 *      with a redirect; anything we do not recognise comes back as
 *      "indeterminate", and the customer is told to ring the shop rather than
 *      shown a confirmation that might be a lie.
 */
import { failure, json, rateLimit } from '../../../server/http';
import { HOSTED_SCHEDULER, reserve, SchedulistaError, type Hold } from '../../../server/schedulista';
import { unseal } from '../../../server/seal';

export type ReserveResponse =
  | { ok: true; message: string }
  | { ok: false; message: string; errors?: string[]; fallbackUrl?: string; expired?: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Body = {
  seal?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
  smsReminder?: unknown;
  /** Honeypot. Real people never fill this in; it is hidden from them. */
  website?: unknown;
};

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function POST(request: Request): Promise<Response> {
  try {
    rateLimit(request, 'reserve', 8, 10 * 60_000);

    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) throw new SchedulistaError('That request could not be read.', 400, false);

    // A filled honeypot is a bot. Answer as though it worked, book nothing.
    if (text(body.website, 100)) {
      return json<ReserveResponse>({ ok: true, message: 'Thanks. Check your email.' });
    }

    const customer = {
      firstName: text(body.firstName, 60),
      lastName: text(body.lastName, 60),
      email: text(body.email, 120),
      phone: text(body.phone, 30),
      notes: text(body.notes, 500),
      smsReminder: body.smsReminder === true,
    };

    // Schedulista requires all four; catching it here saves a round trip and
    // keeps the error next to the field that caused it.
    const errors: string[] = [];
    if (!customer.firstName) errors.push('First name is required.');
    if (!customer.lastName) errors.push('Last name is required.');
    if (!EMAIL.test(customer.email)) errors.push('That email address does not look right.');
    if (customer.phone.replace(/\D/g, '').length < 7) errors.push('A phone number is required.');
    if (errors.length) {
      return json<ReserveResponse>(
        { ok: false, message: 'Please check these details.', errors },
        { status: 400 }
      );
    }

    const hold = unseal<Hold>(text(body.seal, 4000));
    const result = await reserve(hold, customer);

    if (result.ok) {
      return json<ReserveResponse>({
        ok: true,
        message: 'Booked. A confirmation is on its way to your inbox.',
      });
    }

    if ('indeterminate' in result) {
      return json<ReserveResponse>(
        {
          ok: false,
          message:
            'We could not confirm that booking. Please ring the shop on 01992 500010 to check ' +
            'before booking again, so you do not end up with two appointments.',
          errors: result.errors,
          fallbackUrl: HOSTED_SCHEDULER,
        },
        { status: 502 }
      );
    }

    return json<ReserveResponse>(
      { ok: false, message: 'Please check these details.', errors: result.errors },
      { status: 400 }
    );
  } catch (error) {
    return failure(error);
  }
}
