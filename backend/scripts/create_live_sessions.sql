-- Secure metadata for booking-scoped ZEGOCLOUD calls.
CREATE TABLE IF NOT EXISTS public.live_sessions (
    booking_id UUID PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
    student_joined_at TIMESTAMPTZ,
    mentor_joined_at TIMESTAMPTZ,
    student_left_at TIMESTAMPTZ,
    mentor_left_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status
    ON public.live_sessions(status);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Booking participants and admins can read live sessions"
    ON public.live_sessions;

CREATE POLICY "Booking participants and admins can read live sessions"
ON public.live_sessions
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.id = live_sessions.booking_id
          AND (
              b.student_id = auth.uid()
              OR b.mentor_id = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.users u
                  WHERE u.id = auth.uid() AND u.role = 'admin'
              )
          )
    )
);

REVOKE ALL ON public.live_sessions FROM anon, authenticated;
GRANT SELECT ON public.live_sessions TO authenticated;
GRANT ALL ON public.live_sessions TO service_role;
