-- Las tarifas configuradas se expresan en USD por 1.000.000 de tokens.
-- El importe se fija al crear cada evento, para no reescribir el historial
-- si luego se actualiza el precio del modelo.
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
  select input_price_per_million_usd, output_price_per_million_usd
  into input_price, output_price
  from public.agent_configurations
  where is_active = true
    and provider = new.provider
    and model = new.model
  limit 1;

  new.input_cost_usd := round(coalesce(new.input_tokens, 0)::numeric * coalesce(input_price, 0) / 1000000, 8);
  new.output_cost_usd := round(coalesce(new.output_tokens, 0)::numeric * coalesce(output_price, 0) / 1000000, 8);
  new.estimated_cost_usd := new.input_cost_usd + new.output_cost_usd;
  return new;
end;
$$;

drop trigger if exists ai_usage_events_apply_pricing on public.ai_usage_events;
create trigger ai_usage_events_apply_pricing
before insert on public.ai_usage_events
for each row execute function public.apply_ai_usage_pricing();

revoke all on function public.apply_ai_usage_pricing() from public, authenticated;
