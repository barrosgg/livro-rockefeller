-- =====================================================================
-- Migration 009 — Ícones nos produtos
-- =====================================================================
alter table products add column if not exists icon text;

-- Mapeamento inicial baseado no nome do produto.
-- Slugs no formato '<author>/<slug>' apontando para game-icons.net (CC BY 3.0).
-- Os arquivos SVG ficam em /public/icons/<author>__<slug>.svg
update products set icon = case nome
  when 'Açúcar'                  then 'lorc/sugar-cane'
  when 'Algodão'                 then 'lorc/cotton-flower'
  when 'Alho'                    then 'delapouite/garlic'
  when 'Ameixa'                  then 'delapouite/cherry'
  when 'Amora'                   then 'delapouite/strawberry'
  when 'Banana'                  then 'lorc/banana'
  when 'Batata'                  then 'delapouite/potato'
  when 'Cacau'                   then 'delapouite/coffee-beans'
  when 'Café'                    then 'delapouite/coffee-beans'
  when 'Cana-de-açúcar'          then 'lorc/sugar-cane'
  when 'Carne de Porco'          then 'delapouite/pig'
  when 'Carne de Vaca'           then 'delapouite/cow'
  when 'Cenoura'                 then 'delapouite/carrot'
  when 'Coalhada'                then 'delapouite/milk-carton'
  when 'Couro de Cavalo'         then 'lorc/horse-head'
  when 'Fertilizante'            then 'lorc/dung-pile'
  when 'Giseng Americano'        then 'lorc/herbs-bundle'
  when 'Giseng-do-Alaska'        then 'lorc/herbs-bundle'
  when 'Hortelã'                 then 'delapouite/mint-leaf'
  when 'Lã de Ovelha'            then 'delapouite/sheep'
  when 'Laranja'                 then 'delapouite/orange-slice'
  when 'Leite'                   then 'delapouite/milk-carton'
  when 'Leite de Cabra'          then 'delapouite/milk-carton'
  when 'Lúpulo'                  then 'delapouite/grain-bundle'
  when 'Maçã'                    then 'lorc/apple'
  when 'Manteiga'                then 'delapouite/cheese-wedge'
  when 'Milho'                   then 'delapouite/corn'
  when 'Orégano'                 then 'lorc/herbs-bundle'
  when 'Ovo'                     then 'lorc/egg'
  when 'Pêssego'                 then 'delapouite/cherry'
  when 'Queijo'                  then 'delapouite/cheese-wedge'
  when 'Queijo de Cabra'         then 'delapouite/cheese-wedge'
  when 'Ração'                   then 'delapouite/grain-bundle'
  when 'Requeijão'               then 'delapouite/cheese-wedge'
  when 'Ricota'                  then 'delapouite/cheese-wedge'
  when 'Tabaco'                  then 'lorc/herbs-bundle'
  when 'Tomilho'                 then 'lorc/herbs-bundle'
  when 'Trigo'                   then 'lorc/wheat'
  when 'Uva'                     then 'delapouite/strawberry'
  else null
end
where icon is null and nome not like 'Saco de %';

-- Todos os "Saco de X" recebem o ícone de saco
update products set icon = 'lorc/sack' where nome like 'Saco de %' and icon is null;
