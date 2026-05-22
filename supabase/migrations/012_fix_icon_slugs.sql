-- =====================================================================
-- Migration 012 — Corrige os slugs de ícone para usar apenas os que
-- existem confirmadamente em game-icons.net (CC BY 3.0).
-- Slugs que não existem geram fallback (quadrado com inicial).
-- =====================================================================

update products set icon = case nome
  -- ICONES CONFIRMADOS
  when 'Alho'                    then 'delapouite/garlic'
  when 'Ameixa'                  then 'delapouite/cherry'
  when 'Amora'                   then 'delapouite/strawberry'
  when 'Batata'                  then 'delapouite/potato'
  when 'Cacau'                   then 'delapouite/coffee-beans'
  when 'Café'                    then 'delapouite/coffee-beans'
  when 'Carne de Vaca'           then 'delapouite/cow'
  when 'Cenoura'                 then 'delapouite/carrot'
  when 'Couro de Cavalo'         then 'lorc/horse-head'
  when 'Lã de Ovelha'            then 'delapouite/sheep'
  when 'Laranja'                 then 'delapouite/orange-slice'
  when 'Milho'                   then 'delapouite/corn'
  when 'Pêssego'                 then 'delapouite/cherry'
  when 'Ração'                   then 'delapouite/grain-bundle'
  when 'Trigo'                   then 'lorc/wheat'
  when 'Uva'                     then 'delapouite/strawberry'

  -- APROXIMACOES (com icones confirmados)
  when 'Maçã'                    then 'delapouite/cherry'
  when 'Banana'                  then 'delapouite/cherry'
  when 'Carne de Porco'          then 'delapouite/cow'
  when 'Cana-de-açúcar'          then 'delapouite/grain-bundle'
  when 'Lúpulo'                  then 'delapouite/grain-bundle'
  when 'Algodão'                 then 'delapouite/grain-bundle'

  -- SEM ICONE (fallback inicial) — voce edita no Admin > Produtos
  when 'Açúcar'                  then null
  when 'Coalhada'                then null
  when 'Fertilizante'            then null
  when 'Giseng Americano'        then null
  when 'Giseng-do-Alaska'        then null
  when 'Hortelã'                 then null
  when 'Leite'                   then null
  when 'Leite de Cabra'          then null
  when 'Manteiga'                then null
  when 'Orégano'                 then null
  when 'Ovo'                     then null
  when 'Queijo'                  then null
  when 'Queijo de Cabra'         then null
  when 'Requeijão'               then null
  when 'Ricota'                  then null
  when 'Tabaco'                  then null
  when 'Tomilho'                 then null

  else icon
end
where nome not like 'Saco de %';

-- Todos os "Saco de X" usam grain-bundle como aproximação
update products set icon = 'delapouite/grain-bundle' where nome like 'Saco de %';
