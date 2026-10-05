-- Cada consumo conserva el modelo y la tarifa efectiva de su propia transacción.
-- Así, un cambio posterior de modelo o precio no altera la trazabilidad histórica.
alter table public.ai_usage_events
  add column if not exists input_price_per_million_usd numeric(14, 6) not null default 0,
  add column if not exists output_price_per_million_usd numeric(14, 6) not null default 0;

create or replace function public.apply_ai_usage_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  input_price numeric(14, 6) := 0;
  output_price numeric(14, 6) := 0;
begin
  -- provider y model vienen de la respuesta que originó este evento.
  -- Solo una configuración activa con esa combinación puede tasarlo.
  select input_price_per_million_usd, output_price_per_million_usd
  into input_price, output_price
  from public.agent_configurations
  where is_active = true
    and provider = new.provider
    and model = new.model
  limit 1;

  new.input_price_per_million_usd := coalesce(input_price, 0);
  new.output_price_per_million_usd := coalesce(output_price, 0);
  new.input_cost_usd := round(coalesce(new.input_tokens, 0)::numeric * new.input_price_per_million_usd / 1000000, 8);
  new.output_cost_usd := round(coalesce(new.output_tokens, 0)::numeric * new.output_price_per_million_usd / 1000000, 8);
  new.estimated_cost_usd := new.input_cost_usd + new.output_cost_usd;
  return new;
end;
$$;
