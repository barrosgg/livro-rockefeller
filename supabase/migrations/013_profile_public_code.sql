-- =====================================================================
-- Migration 013 — Link público da credencial
-- =====================================================================

alter table profiles add column if not exists public_code text;

-- Backfill para perfis existentes
do $$
declare r record; tentativa text;
begin
  for r in select id from profiles where public_code is null loop
    loop
      tentativa := public.gen_alpha_code(10);
      begin
        update profiles set public_code = tentativa where id = r.id;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
end $$;

alter table profiles alter column public_code set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_public_code_unique') then
    alter table profiles add constraint profiles_public_code_unique unique(public_code);
  end if;
end $$;

alter table profiles alter column public_code set default public.gen_alpha_code(10);
create index if not exists profiles_public_code_idx on profiles(public_code);

-- RPC público que devolve credencial (sem expor email/auth.id)
create or replace function public.get_profile_public(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from profiles where public_code = p_code and disabled = false;
  if not found then
    raise exception 'Credencial não encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'nome_completo', p.nome_completo,
    'identificacao', p.identificacao,
    'conta_bancaria', p.conta_bancaria,
    'correio', p.correio,
    'role', p.role,
    'avatar', p.avatar,
    'criado_em', p.criado_em,
    'public_code', p.public_code
  );
end $$;

grant execute on function public.get_profile_public(text) to anon, authenticated;
