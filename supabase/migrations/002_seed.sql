-- ============================================================
-- SEED: People
-- ============================================================
INSERT INTO people (id, name, role, institution, nationality, is_public_figure, bio) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'Ricardo Martinelli',
  'Ex-Presidente de la República',
  'Presidencia de la República de Panamá',
  'PA', true,
  'Presidente de Panamá 2009-2014. Condenado en 2023 a 10 años y 8 meses por espionaje político. Fue extraditado de EE.UU. en 2023. También enfrenta cargos de peculado.'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'Federico Suárez',
  'Ex-Ministro de Obras Públicas',
  'Ministerio de Obras Públicas',
  'PA', true,
  'Ministro de Obras Públicas durante el gobierno de Martinelli. Condenado en 2023 a 14 años de prisión y multa de $27.4 millones por el caso Blue Apple (Servicios Blue Apple).'
),
(
  'a1000000-0000-0000-0000-000000000003',
  'Luis Enrique Martinelli Linares',
  'Empresario',
  'Grupo Melo / Empresas privadas',
  'PA', true,
  'Hijo mayor del ex-presidente Ricardo Martinelli. Se declaró culpable en EE.UU. de conspiración de lavado de dinero, habiendo recibido más de $28 millones en sobornos de Odebrecht.'
),
(
  'a1000000-0000-0000-0000-000000000004',
  'Ricardo Martinelli Linares',
  'Empresario',
  'Grupo Melo / Empresas privadas',
  'PA', true,
  'Hijo del ex-presidente Ricardo Martinelli. Se declaró culpable junto a su hermano en EE.UU. de conspiración de lavado de dinero relacionada con sobornos de Odebrecht.'
),
(
  'a1000000-0000-0000-0000-000000000005',
  'Ramón Fonseca Mora',
  'Abogado / Co-fundador Mossack Fonseca',
  'Mossack Fonseca & Co.',
  'PA', true,
  'Co-fundador del bufete Mossack Fonseca, cuya filtración conocida como Panama Papers en 2016 expuso el uso global de empresas panameñas de fachada para evadir impuestos y ocultar riqueza.'
),
(
  'a1000000-0000-0000-0000-000000000006',
  'Jürgen Mossack',
  'Abogado / Co-fundador Mossack Fonseca',
  'Mossack Fonseca & Co.',
  'DE', true,
  'Co-fundador del bufete Mossack Fonseca. Junto a Ramón Fonseca, fue acusado de blanqueo de capitales. Los 28 acusados en el juicio panameño fueron absueltos en 2024.'
),
(
  'a1000000-0000-0000-0000-000000000007',
  'Néstor Osorio',
  'Ex-Director de Contrataciones Públicas',
  'Dirección General de Contrataciones Públicas',
  'PA', true,
  'Funcionario implicado en irregularidades en el proceso de licitación durante el caso Blue Apple.'
),
(
  'a1000000-0000-0000-0000-000000000008',
  'Álvaro Alemán',
  'Ex-Secretario General de la Presidencia',
  'Presidencia de la República',
  'PA', true,
  'Secretario General de la Presidencia durante el gobierno de Martinelli. Implicado en el caso Blue Apple por supuesta facilitación de contratos irregulares.'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: Findings
-- ============================================================
INSERT INTO findings (id, title, summary, severity, category, amount_usd, date_reported, date_occurred, source_url) VALUES
(
  'b1000000-0000-0000-0000-000000000001',
  'Caso Odebrecht - Sobornos para Contratos de Infraestructura',
  'La constructora brasileña Odebrecht pagó aproximadamente $59 millones en sobornos entre 2010 y 2014 a funcionarios panameños para asegurar contratos de obras públicas. Los sobrecostos acumulados superaron los $2,000 millones. Los hijos del ex-presidente Martinelli, Luis Enrique y Ricardo Martinelli Linares, recibieron más de $28 millones en sobornos canalizados a través de cuentas offshore, y se declararon culpables en EE.UU. en 2021.',
  'critico', 'Fraude en Contratación Pública', 2000000000,
  '2017-06-01', '2010-01-01',
  'https://ministeriopublico.gob.pa/casos-complejos/casos-fiscalia-de-anticorrupcion/'
),
(
  'b1000000-0000-0000-0000-000000000002',
  'Panama Papers - Mossack Fonseca y Evasión Fiscal Global',
  'En abril de 2016, el Consorcio Internacional de Periodistas de Investigación (ICIJ) publicó 11.5 millones de documentos filtrados del bufete panameño Mossack Fonseca. Los documentos revelaron el uso sistemático de empresas de fachada panameñas por parte de líderes mundiales, celebridades y criminales para ocultar riqueza y evadir impuestos. En 2024, un tribunal panameño absolvió a los 28 acusados, incluyendo a Ramón Fonseca y Jürgen Mossack, por razones procesales.',
  'critico', 'Lavado de Dinero', NULL,
  '2016-04-03', '2000-01-01',
  'https://www.icij.org/investigations/panama-papers/'
),
(
  'b1000000-0000-0000-0000-000000000003',
  'Blue Apple / Servicios Blue Apple - Contratos Públicos Fraudulentos',
  'El caso Servicios Blue Apple involucra el otorgamiento de contratos públicos sobrevalorados durante el gobierno de Martinelli (2009-2014) a la empresa Blue Apple. El ex-ministro de Obras Públicas Federico Suárez fue condenado en 2023 a 14 años de prisión y una multa de $27.4 millones. En total, ocho personas fueron sentenciadas en este caso que expuso la corrupción sistemática en la contratación pública panameña.',
  'critico', 'Fraude en Contratación Pública', 27400000,
  '2015-03-01', '2009-01-01',
  'https://ministeriopublico.gob.pa/casos-complejos/casos-fiscalia-de-anticorrupcion/'
),
(
  'b1000000-0000-0000-0000-000000000004',
  'FCC Construcción - Sobornos para Contratos en Panamá',
  'La empresa española Fomento de Construcciones y Contratas (FCC) pagó más de 82 millones de euros en sobornos a funcionarios panameños para asegurar contratos de obras públicas e infraestructura. El caso fue investigado simultáneamente en España y Panamá, siendo uno de los mayores escándalos de corrupción con participación de empresas europeas en Centroamérica.',
  'critico', 'Fraude en Contratación Pública', 90000000,
  '2016-01-01', '2008-01-01',
  'https://elpais.com/economia/2016/09/30/actualidad/1475258741_847567.html'
),
(
  'b1000000-0000-0000-0000-000000000005',
  'Panama Ports Company - Pérdidas al Estado por Contrato Desfavorable',
  'El contrato con Panama Ports Company (subsidiaria de Hutchison Whampoa de Hong Kong) para operar los puertos de Balboa y Cristóbal fue modificado en condiciones desfavorables para el Estado panameño. Las pérdidas estatales se estiman en más de $1,200 millones. En 2024, el gobierno de Mulino declaró caducado el contrato, pero la empresa recurrió ante cortes internacionales de arbitraje.',
  'critico', 'Captura del Estado', 1200000000,
  '2021-01-01', '1997-01-01',
  'https://www.prensa.com/economia/panama-ports-company/'
),
(
  'b1000000-0000-0000-0000-000000000006',
  'Ricardo Martinelli - Peculado con Fondos del Estado',
  'El ex-presidente Ricardo Martinelli fue acusado de desviar fondos públicos para adquirir propiedades de lujo y financiar actividades personales y políticas. En 2023 fue condenado a 10 años y 8 meses de prisión por espionaje político (Caso Pinchazos), y enfrenta cargos adicionales de peculado por el uso indebido de recursos del Estado durante su mandato (2009-2014).',
  'alto', 'Peculado / Malversación', 50000000,
  '2018-06-11', '2009-01-01',
  'https://www.prensa.com/judiciales/caso-martinelli/'
),
(
  'b1000000-0000-0000-0000-000000000007',
  'PDVSA / Vuelo de Dinero - Red de Lavado con Venezuela',
  'Un esquema de corrupción de $1,200 millones vinculó a la estatal venezolana PDVSA con redes financieras panameñas. Dinero procedente de sobornos y malversación en Venezuela fue lavado a través del sistema bancario panameño y empresas de fachada. El caso fue investigado simultáneamente en EE.UU., España, Argentina y Panamá, resultando en múltiples arrestos y congelamiento de activos.',
  'alto', 'Lavado de Dinero', 1200000000,
  '2018-01-01', '2010-01-01',
  'https://insightcrime.org/news/analysis/pdvsa-panama-money-laundering/'
),
(
  'b1000000-0000-0000-0000-000000000008',
  'Compras Irregulares COVID-19 - Sobreprecio en Insumos Médicos',
  'Durante la pandemia de COVID-19 (2020-2021), el gobierno panameño realizó compras de emergencia de insumos médicos (mascarillas, respiradores, medicamentos) a precios significativamente superiores al mercado, sin licitación pública. La Contraloría General detectó irregularidades en contratos por decenas de millones de dólares. La Fiscalía Anticorrupción inició investigaciones que incluyeron a funcionarios del Ministerio de Salud y del CSS.',
  'medio', 'Abuso en Emergencias', 45000000,
  '2020-09-01', '2020-03-01',
  'https://www.tvn-2.com/nacionales/salud/compras-covid-panama/'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED: Finding-People relationships
-- ============================================================
INSERT INTO finding_people (finding_id, person_id, role_in_case, amount_usd, is_convicted) VALUES
-- Odebrecht
('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'Receptor de sobornos / Intermediario', 14000000, true),
('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 'Receptor de sobornos / Intermediario', 14000000, true),
('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Presunto beneficiario político', NULL, false),
-- Panama Papers
('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005', 'Co-fundador del bufete / Principal acusado', NULL, false),
('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 'Co-fundador del bufete / Principal acusado', NULL, false),
-- Blue Apple
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'Principal acusado / Condenado', 27400000, true),
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Jefe de gobierno durante el período', NULL, false),
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000007', 'Funcionario implicado', NULL, false),
('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000008', 'Facilitador de contratos', NULL, false),
-- Martinelli peculado
('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'Principal acusado', 50000000, false),
-- PDVSA
('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'Presunto facilitador político', NULL, false)
ON CONFLICT (finding_id, person_id) DO NOTHING;

-- ============================================================
-- SEED: Person relationships
-- ============================================================
INSERT INTO person_relationships (person_a_id, person_b_id, relationship, description) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000003',
  'familiar', 'Padre e hijo — Ricardo Martinelli y Luis Enrique Martinelli Linares'
),
(
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000004',
  'familiar', 'Padre e hijo — Ricardo Martinelli y Ricardo Martinelli Linares'
),
(
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'familiar', 'Hermanos — Luis Enrique y Ricardo Martinelli Linares'
),
(
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'politico', 'Martinelli nombró a Federico Suárez como Ministro de Obras Públicas'
),
(
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000008',
  'politico', 'Martinelli nombró a Álvaro Alemán como Secretario General de la Presidencia'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000007',
  'empleado', 'Federico Suárez supervisaba a Néstor Osorio como director de contrataciones'
),
(
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006',
  'socio_comercial', 'Co-fundadores del bufete Mossack Fonseca & Co.'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Sources
-- ============================================================
INSERT INTO sources (finding_id, url, title, outlet, published_at) VALUES
('b1000000-0000-0000-0000-000000000001', 'https://www.doj.gov/opa/pr/odebrecht-and-braskem-plead-guilty-andagree-pay-least-35-billion-global-penalties', 'Odebrecht and Braskem Plead Guilty', 'U.S. Department of Justice', '2016-12-21'),
('b1000000-0000-0000-0000-000000000001', 'https://www.prensa.com/judiciales/hijos-martinelli-odebrecht/', 'Hijos de Martinelli se declaran culpables por Odebrecht', 'La Prensa Panamá', '2021-08-16'),
('b1000000-0000-0000-0000-000000000002', 'https://www.icij.org/investigations/panama-papers/', 'Panama Papers', 'ICIJ', '2016-04-03'),
('b1000000-0000-0000-0000-000000000002', 'https://www.tvn-2.com/nacionales/judiciales/panama-papers-absueltos/', 'Absuelven a acusados Panama Papers', 'TVN-2', '2024-07-10'),
('b1000000-0000-0000-0000-000000000003', 'https://www.prensa.com/judiciales/blue-apple-condenan-federico-suarez/', 'Condenan a Federico Suárez en caso Blue Apple', 'La Prensa Panamá', '2023-04-05'),
('b1000000-0000-0000-0000-000000000006', 'https://www.prensa.com/judiciales/martinelli-condenado-pinchazos/', 'Martinelli condenado a 10 años en caso Pinchazos', 'La Prensa Panamá', '2023-08-09'),
('b1000000-0000-0000-0000-000000000007', 'https://insightcrime.org/news/analysis/pdvsa-panama-money-laundering/', 'PDVSA Panama Money Laundering Network', 'InSight Crime', '2019-03-15'),
('b1000000-0000-0000-0000-000000000008', 'https://www.tvn-2.com/nacionales/salud/compras-irregulares-covid/', 'Compras irregulares durante COVID-19 en Panamá', 'TVN-2', '2020-12-01')
ON CONFLICT DO NOTHING;
