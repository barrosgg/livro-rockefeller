-- =====================================================================
-- Migration 014 — Contrato de prestação de serviços assinado
-- =====================================================================
alter table profiles add column if not exists contrato_assinado_em timestamptz;

-- Atualiza get_profile_public para incluir o status do contrato
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
    'public_code', p.public_code,
    'contrato_assinado_em', p.contrato_assinado_em
  );
end $$;
