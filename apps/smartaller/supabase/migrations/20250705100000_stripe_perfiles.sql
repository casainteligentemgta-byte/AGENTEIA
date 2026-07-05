-- Stripe: IDs de cliente y suscripción en perfiles B2C

alter table public.perfiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

comment on column public.perfiles.stripe_customer_id is 'Stripe Customer ID (cus_...)';
comment on column public.perfiles.stripe_subscription_id is 'Stripe Subscription ID (sub_...)';

create unique index if not exists idx_perfiles_stripe_customer
  on public.perfiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_perfiles_stripe_subscription
  on public.perfiles (stripe_subscription_id)
  where stripe_subscription_id is not null;
