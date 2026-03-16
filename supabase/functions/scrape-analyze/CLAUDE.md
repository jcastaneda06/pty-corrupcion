# CLAUDE.md
This file explains how to work with and modify the `scrape-analyze` edge function to properly work with `pty-corrupcion` principles.

## Objective
The goal of this edge function is to scrape the web for information about corrupt acts performed by politicians.

## Approach
When you modify this function, always make sure that the core principles of the function remain the same:
- The function should search the web for news (panamanian or international) that involve corrupt politicians
- The function has to focus on news that contain or are related to the `SEARCH_QUERIES` array.
- When you modify the `scrape-analyze` function always make sure that the function is coded to look for old and recent news. Old news should have more relevance than new unless there's money involved.
- When a new has money involved it should be prioritized over news that don't mention money

## Triggering `corrupt-politician`

The corrupt politician edge function should always be triggered when a news includes one of the following politicians (spanish):

> **Nota:** Este documento es una referencia de funcionarios electos y designados en Panamá desde 1999 (inicio del gobierno de Moscoso) hasta el presente. Incluye presidentes, gabinetes, diputados de la Asamblea Nacional y alcaldes. Los datos provienen de fuentes oficiales del Tribunal Electoral, la Georgetown Political Database of the Americas y Wikipedia.  
> **⚠️ Advertencia:** La información de gabinetes puede ser incompleta en cuanto a cambios intermedios; algunos ministros sustituyeron a otros durante el transcurso del quinquenio. Panama **no tiene Senado** — el poder legislativo es unicameral: la **Asamblea Nacional**, cuyos miembros se llaman "diputados".

---

## 1. Ejecutivo — Presidentes y Vicepresidentes

| Período | Presidente | Partido | Vicepresidente(s) |
|---------|-----------|---------|-------------------|
| 1999–2004 | Mireya Moscoso Rodríguez | Partido Arnulfista | Arturo Vallarino (1er VP) |
| 2004–2009 | Martín Torrijos Espino | PRD | Samuel Lewis Navarro (1er VP), Rubén Arosemena (2do VP) |
| 2009–2014 | Ricardo Martinelli Berrocal | Cambio Democrático | Juan Carlos Varela (1er VP) |
| 2014–2019 | Juan Carlos Varela Rodríguez | Partido Panameñista | Isabel de Saint Malo de Alvarado (VP) |
| 2019–2024 | Laurentino "Nito" Cortizo Cohen | PRD | José Gabriel Carrizo Jaén (VP) |
| 2024–2029 | José Raúl Mulino Quintero | RM / Realizando Metas | José Raúl Mulino (VP: cargo vacante) |

---

## 2. Gabinetes

### 2.1 Gobierno de Mireya Moscoso (1999–2004)

| Ministerio | Ministro(s) |
|-----------|------------|
| Relaciones Exteriores | José Miguel Alemán |
| Gobierno y Justicia | Winston Spadafora; luego sucesores |
| Economía y Hacienda / Hacienda y Tesoro | Norberto Delgado |
| Educación | Doris Rosas de Mata |
| Salud | José Terán; reemplazado por Fernando Gracia |
| Obras Públicas | Eduardo de Bello |
| Desarrollo Agropecuario (MIDA) | Alejandro Posse; Pedro Adán Gordón; Lynette Stanziola |
| Comercio e Industrias (MICI) | Joaquín Jácome |
| Trabajo y Desarrollo Laboral | J.J. Vallarino (Partido MORENA) |
| Vivienda | Miguel Cárdenas |
| Asuntos del Canal | Ricardo Martinelli (luego director de la ACP) |
| Juventud, Mujer, Niñez y Familia | Alba de Rolla |
| Presidencia | (varios) |

> La coalición de gobierno ("Unión por Panamá") incluyó el Partido Arnulfista, MOLIRENA, Cambio Democrático y MORENA.

---

### 2.2 Gobierno de Martín Torrijos (2004–2009)

| Ministerio | Ministro(s) |
|-----------|------------|
| Relaciones Exteriores | Samuel Lewis Navarro (también 1er VP) |
| Gobierno y Justicia | Héctor Alemán |
| Economía y Finanzas | Ricaurte Vásquez Morales |
| Educación | Juan Bosco Bernal; Miguel Ángel Cañizales; Belgis Castro; (otra persona) |
| Salud | Camilo Alleyne; Rosario Turner (desde 2007) |
| Obras Públicas | Carlos Vallarino |
| Desarrollo Agropecuario | Laurentino Cortizo Cohen (renunció); sucesores |
| Comercio e Industrias | Alejandro Ferrer |
| Trabajo y Desarrollo Laboral | Reynaldo Rivera |
| Vivienda | Balbina Herrera |
| Desarrollo Social | Leonor Calderón |
| Presidencia | Ubaldino Real |
| Turismo (IPAT, rango ministerial) | Rubén Blades (Director-Ministro) |
| Autoridad Marítima (rango director) | Rubén Arosemena (2do VP) |

---

### 2.3 Gobierno de Ricardo Martinelli (2009–2014)

| Ministerio | Ministro(s) destacados |
|-----------|----------------------|
| Relaciones Exteriores | Juan Carlos Varela (1er VP, hasta separación); Roberto Henríquez (desde ago. 2011) |
| Gobierno y Justicia | José Raúl Mulino (hasta abr. 2010); Roxana Méndez (desde abr. 2010) |
| Seguridad Pública (creado en 2010) | José Raúl Mulino (desde abr. 2010) |
| Economía y Finanzas | Alberto Vallarino Clément |
| Educación | Lucy Molinar |
| Salud | Franklin Vergara J. |
| Obras Públicas | Federico José Suárez |
| Desarrollo Agropecuario | Víctor Manuel Pérez Batista; Emilio Kieswetter (desde jun. 2010) |
| Comercio e Industrias | Roberto Henríquez (hasta ago. 2011); Ricardo Quijano (desde ago. 2011) |
| Trabajo y Desarrollo Laboral | Alma Lorena Cortés Aguilar |
| Vivienda y Ordenamiento Territorial | Carlos Alberto Duboy Sierra; José Domingo Arias (desde sep. 2011) |
| Desarrollo Social | Guillermo Antonio Ferrufino Benítez |
| Presidencia | Demetrio Papadimitriu |
| MIPYME (Micro, Pequeña y Mediana Empresa) | Giselle Burillo |
| Asuntos del Canal | Rómulo Roux |
| Turismo (ATP, rango ministerial) | Salomón Shamah Zuchin |

---

### 2.4 Gobierno de Juan Carlos Varela (2014–2019)

| Ministerio | Ministro(s) iniciales |
|-----------|----------------------|
| Vicepresidencia / Relaciones Exteriores | Isabel de Saint Malo de Alvarado |
| Gobierno | Rodolfo Aguilera Franceschi |
| Economía y Finanzas | Dulcidio De La Guardia |
| Educación | Marcela Paredes de Vásquez |
| Salud | Francisco Terrientes; luego Nina Mojica |
| Obras Públicas | Ramón Morales |
| Desarrollo Agropecuario | Eduardo Enrique Carles |
| Comercio e Industrias | Melitón Arrocha |
| Trabajo y Desarrollo Laboral | Luis Ernesto Carles |
| Vivienda y Ordenamiento Territorial | Mario Etchelecu |
| Desarrollo Social | Alcibíades Vásquez |
| Presidencia | Álvaro Alemán |
| Asuntos del Canal | Roberto Roy |
| Seguridad Pública | Alexis Bethancourt Yau |
| Ambiente | Emilio Sempris |

---

### 2.5 Gobierno de Laurentino Cortizo (2019–2024)

| Ministerio | Ministro(s) iniciales |
|-----------|----------------------|
| Presidencia | José Gabriel Carrizo Jaén (también VP) |
| Relaciones Exteriores | Alejandro Ferrer; Erika Mouynes (desde dic. 2020); Janaina Tewaney (desde oct. 2022) |
| Gobierno | Carlos Romero; Sheyla Grajales; Janaina Tewaney Mencomo |
| Economía y Finanzas | Héctor Alexander |
| Educación | Maruja Gorday de Villalobos |
| Salud | Rosario Turner |
| Obras Públicas | Rafael Sabonge |
| Desarrollo Agropecuario | Augusto Valderrama |
| Comercio e Industrias | Ramón Martínez; luego Federico Alfaro Boyd |
| Trabajo y Desarrollo Laboral | Doris Zapata |
| Vivienda y Ordenamiento Territorial | Inés Samudio |
| Desarrollo Social | Markova Concepción; luego sucesores |
| Seguridad Pública | Rolando Mirones |
| Asuntos del Canal | Samuel Lewis Navarro; Arístides Royo; luego otros |
| Ambiente | Milciades López |
| Cultura (creado ago. 2019) | Carlos Aguilar; luego sucesores |
| La Mujer (creado mar. 2023) | Juana Herrera |

---

### 2.6 Gobierno de José Raúl Mulino (2024–2029)

| Ministerio | Ministro designado (julio 2024) |
|-----------|-------------------------------|
| Relaciones Exteriores | Javier Eduardo Martínez-Acha Vásquez |
| Gobierno | Roger Tejada |
| Economía y Finanzas | Felipe Chapman |
| Educación | (por confirmar al inicio) |
| Salud | Fernando Boyd Galindo |
| Obras Públicas | José Luis Andrade |
| Desarrollo Agropecuario | Roberto Linares |
| Comercio e Industrias | Julio Moltó |
| Trabajo y Desarrollo Laboral | (por confirmar al inicio) |
| Vivienda y Ordenamiento Territorial | (por confirmar al inicio) |
| Desarrollo Social | Beatriz Carles |
| Seguridad Pública | Frank Ábrego |
| Asuntos del Canal | José Ramón Icaza |
| Ambiente | Juan Carlos Navarro |
| La Mujer | Niurka Palacios |
| Presidencia | Juan Carlos Orillac |

---

## 3. Asamblea Nacional — Diputados

> Panamá **no tiene Senado**. La Asamblea Nacional es unicameral con 71 diputados electos por circuitos cada cinco años.

---

### 3.1 Diputados 1999–2004 (Asamblea Legislativa)

Electos el 2 de mayo de 1999.

| Provincia / Comarca | Circuito | Diputado | Partido |
|--------------------|---------|---------|---------|
| **Bocas del Toro** | 1.1 | Felipe Serrano | PRD |
| | 1.1 | Eleuteria Miller | PRD |
| | 1.2 | Benicio Enacio Robinson | PRD |
| **Coclé** | 2.1 | Mario Quiel | Liberal Auténtico |
| | 2.1 | César Pardo | PRD |
| | 2.2 | Bolívar Pariente | Liberal |
| | 2.3 | Juan Manuel Peralta Ríos | PRD |
| | 2.4 | Noriel Salerno Estévez | Solidaridad |
| **Colón** | 3.1 | Leopoldo Benedetti | Arnulfista |
| | 3.1 | Abelardo Antonio | PRD |
| | 3.1 | Jorge Díaz | Papa Egoro |
| | 3.1 | Miguel Bush Ríos | PRD |
| | 3.2 | Laurentino Cortizo Cohen | Solidaridad |
| **Chiriquí** | 4.1 | Denis Arce | PRD |
| | 4.1 | Edgardo Álvarez | PRD |
| | 4.1 | Lorenzo Acosta | PRD |
| | 4.2 | Carlos Smith | PRD |
| | 4.2 | Yadira González | PRD |
| | 4.3 | Alfredo Arias | Arnulfista |
| | 4.4 | Enrique Montezuma | PRD |
| | 4.5 | José Carreño | — |
| | 4.6 | Carlos Ramón Alvarado | PRD |
| | 4.7 | Rodrigo Jované | Liberal Auténtico |
| **Darién** | 5.1 | Haydee Lay | Solidaridad |
| | 5.2 | Jaime Lore | Liberal |
| **Herrera** | 6.1 | Alberto Castillero | Solidaridad |
| | 6.2 | José Varela | Arnulfista |
| | 6.3 | Pablo Quintero Luna | Liberal Auténtico |
| **Los Santos** | 7.1 | Carlos Afú | PRD |
| | 7.2 | Alberto Cigarruista | Arnulfista |
| | 7.3 | Juan Delgado | PRD |
| **Panamá** | 8.1 | Abel Rodríguez | PRD |
| | 8.1 | Lenín Sucre Benjamín | Liberal |
| | 8.1 | Donato Rosales Ortega | PRD |
| | 8.1 | Gerardo González | PRD |
| | 8.1 | Arturo Vallarino B. | MOLIRENA |
| | 8.1 | Daniel Arias | Arnulfista |
| | 8.1 | Roberto Will Guerrero | Papa Egoro |
| | 8.2 | Oreste Vásquez | UDI |
| | 8.3 | Joaquín F. Franco | Arnulfista |
| | 8.4 | Tomás G. Altamirano Mantovani | PRD |
| | 8.5 | Arístides De Icaza | Renovación Civilista |
| | 8.5 | Roberto Ábrego Torres | PRD |
| | 8.6 | Balbina Herrera Araúz | PRD |
| | 8.6 | Gloria Young | Papa Egoro |
| | 8.6 | José del C. Serracín Acosta | Arnulfista |
| | 8.6 | Raymundo Hurtado Lay | MOLIRENA |
| | 8.6 | César Sanjur | PRD |
| | 8.6 | Víctor López | PRD |
| | 8.7 | Alberto Alemán Boyd | PRD |
| | 8.7 | Mariela Jiménez | Papa Egoro |
| | 8.7 | Lucas Ramón Zarak | Arnulfista |
| | 8.7 | Franz Olmedo Weber | PRD |
| | 8.8 | Oydén Ortega Durán | PRD |
| | 8.8 | Rodrigo Arosemena | MOLIRENA |
| | 8.8 | Rubén Arosemena | PDC |
| | 8.8 | Víctor Méndez Fábrega | Papa Egoro |
| | 8.8 | Marco Antonio Ameglio | MOLIRENA |
| | 8.9 | Elías Castillo | PRD |
| | 8.9 | Olmedo Guillén | Renovación Civilista |
| | 8.9 | Bernabé Pérez Frachiola | Papa Egoro |
| | 8.9 | Olivia de Pomares | PRD |
| | 8.9 | Manuel De La Hoz | PRD |
| **Veraguas** | 9.1 | Adolfo Elías Tuñón | PRD |
| | 9.1 | Carlos Santana | Arnulfista |
| | 9.2 | Héctor Aparicio | MOLIRENA |
| | 9.3 | Enrique Riley Puga | PRD |
| | 9.4 | Mario Forero Mojica | MOLIRENA |
| | 9.5 | Manuel Ortíz S. | Arnulfista |
| **San Blas / Kuna Yala** | 10.1 | Enrique Garrido A. | Arnulfista |
| | 10.2 | Rogelio Alba | PRD |

---

### 3.2 Diputados 2004–2009

> Electos el 2 de mayo de 2004. La Asamblea pasó a llamarse "Asamblea Nacional" y se fijó en 71 el número de diputados.

*Nota: Los datos completos de los 71 diputados electos en 2004 por circuito no están disponibles en fuentes digitalizadas de fácil acceso. A continuación se listan los conocidos más prominentes:*

- **Tomás Arosemena Galindo** — Presidente de la Asamblea Nacional (2004)
- **Jerry Wilson** — Presidente de la Asamblea (tomó posesión a Torrijos)
- **Crispiano Adames Navarro** — PRD, Ciudad de Panamá
- **Pedro Miguel González** — PRD (fue presidente de la Asamblea)
- **Sergio Gálvez** — CD
- **Raúl Pineda** — PRD, San Miguelito
- **Dalia Bernal** — CD, San Miguelito
- **Zulay Rodríguez** — PRD, San Miguelito (reelecta múltiples veces)
- **Abelardo Antonio** — PRD, Colón
- **Denis Arce** — PRD, Chiriquí
- **Leopoldo Archibold** — Comarca Ngöbe Buglé

---

### 3.3 Diputados 2009–2014

Electos el 3 de mayo de 2009.

| Provincia / Comarca | Circuito | Diputado | Partido |
|--------------------|---------|---------|---------|
| **Bocas del Toro** | 1-1 | Benicio Enacio Robinson Grajales | PRD / PL |
| | 1-1 | Mario Lew Miller Byrnes | CD |
| **Coclé** | 2-1 | Renaul Domínguez Villarreal | PRD / PL |
| | 2-1 | Jorge Iván Arrocha Rosario | PAN |
| | 2-2 | Raúl Antonio Hernández López | CD / UP |
| | 2-3 | Dana Darís Castañeda Guardia | CD / UP |
| | 2-4 | Noriel Salerno Estévez | CD / UP |
| **Colón** | 3-1 | Abelardo Enrique Antonio Quijano | PRD |
| | 3-1 | Miguel Lorenzo Salas Oglesby | PAN |
| | 3-1 | Julio Luque Garay | CD |
| | 3-1 | Iracema Ayarza Parra de Dale | PRD / PL |
| | 3-2 | Nelson Jackson Palma | PRD / PL |
| **Chiriquí** | 4-1 | Denis Arce Morales | PRD / PL |
| | 4-1 | Rogelio Agustín Baruco Mojica | CD |
| | 4-1 | Miguel Ángel Fanovich Tijerino | PAN |
| | 4-2 | Osman Camilo Gómez | MOLIRENA / PAN |
| | 4-3 | Pablo Vargas Caballero | PAN |
| | 4-3 | Rony Ronald Aráuz González | PRD / Popular / PL |
| | 4-4 | José Manuel Lozada Morales | PRD / Popular / PL |
| | 4-5 | Hugo Alvin Moreno González | MOLIRENA / PAN / UP |
| | 4-6 | Jorge Alberto Rosas Rodríguez | MOLIRENA / PAN / CD |
| **Darién** | 5-1 | Luis Eduardo Lay Milanés | MOLIRENA / PAN |
| | 5-2 | Salvador Real Chen | MOLIRENA / CD / UP |
| **Herrera** | 6-1 | Manuel Cohen Salerno | MOLIRENA / PAN |
| | 6-2 | José Luis Varela Rodríguez | MOLIRENA / PAN / CD |
| | 6-3 | Juan Miguel Ríos González | MOLIRENA / PAN |
| **Los Santos** | 7-1 | Carlos Agustín Afú Decerega | — |
| | 7-1 | Carlos Agustín Afú Brandao | Libre Postulación |
| | 7-2 | Francisco Eloy Vega | PRD / Popular / PL |
| **Panamá** | 8-1 | Rogelio Enrique Paredes Robles | PRD / PL |
| | 8-1 | Marilyn Elizabeth Vallarino Bartuano | CD |
| | 8-1 | Ricardo Alejandro Valencia Arias | PAN |
| | 8-2 | Yanibel Yineva Ábrego Smith | Libre Postulación |
| | 8-3 | José María Herrera Ocaña | MOLIRENA / PAN |
| | 8-4 | Hernán Delgado Quintero | MOLIRENA / PAN / CD / UP |
| | 8-5 | Guillermo Antonio Ferrufino Benítez | CD |
| | 8-5 | Rubén Darío Frías Ortega | — |
| | 8-5 | Noris Hermelinda Salazar de Domínguez | PRD |
| | 8-5 | Arístides de Icaza Hidalgo | CD |
| | 8-6 | Miguel Alemán Alegría | PRD |
| | 8-6 | Raúl Gilberto Pineda Vergara | PRD / Popular / PL |
| | 8-6 | Francisco José Alemán Mendoza | PAN |
| | 8-6 | Dalia Mirna Bernal Yañez | CD / UP |
| | 8-6 | Marina Esther Ardines Lasso | CD / UP |
| | 8-6 | Marcos Aurelio González González | CD |
| | 8-6 | Abraham Martínez Montilla | PRD / Popular |
| | 8-6 | Leandro Ávila | PRD / Popular |
| | 8-7 | Crispiano Adames Navarro | PRD / PL |
| | 8-7 | Sergio Rafael Gálvez Evers | CD |
| | 8-7 | José Isidro Blandón Figueroa | PAN |
| | 8-7 | Adolfo Tomar Valderrama Rodríguez | — |
| | 8-7 | Diego Enrique Lombana Franceschi | PAN / CD |
| | 8-7 | Víctor Nelson Juliáo Toral | PAN / CD |
| | 8-8 | José Luis Fábrega Polleri | PRD |
| | 8-8 | Fernando Guillermo Carrillo Silvestri | CD |
| | 8-8 | Luis Eduardo Quirós Bernal | PAN |
| | 8-8 | Elías Ariel Castillo González | PRD / Popular / PL |
| | 8-8 | Gabriel Enrique Méndez de la Guardia | PRD / PL |
| | 8-9 | Yassir Aboobeker Purcait Saborio | PRD |
| | 8-9 | Vidal García Ureña | CD |
| | 8-9 | Tito Rodríguez Mena | PAN |
| | 8-10 | Juan Carlos Arosemena Valdés | PRD / Popular / PL |
| | 8-10 | José Muñoz Molina | — |
| | 8-10 | Jackeline del Carmen Muñoz Cedeño | CD |
| | 8-10 | Alcibíades Vásquez Velásquez | PAN |
| | 8-10 | Edwin Alberto Zúñiga Mencomo | MOLIRENA / PAN / CD |
| **Veraguas** | 9-1 | Rubén de León Sánchez | PRD / Popular / PL |
| | 9-1 | Carlos Alberto Santana Rodríguez | PAN |
| | 9-2 | Héctor Eduardo Aparicio Díaz | MOLIRENA / PAN |
| | 9-3 | Francisco Javier Brea Clavel | MOLIRENA / PAN / CD |
| | 9-4 | Freidi Martín Torres Díaz | PRD / Popular / PL |
| **Kuna Yala** | 10-1 | Juan Antonio Martínez Díaz | PRD / PL |
| | 10-2 | Absalón Herrera García | PRD / Popular / PL |
| **Ngöbe Buglé** | 12-1 | Leopoldo Angelino Archibold Hooker | CD |
| | 12-2 | Irene Gallego Carpintero | Popular / PL |
| | 12-3 | Crescencia Prado García | PRD / PL |

---

### 3.4 Diputados 2014–2019

*Lista parcial de diputados destacados de este período:*

- **Yanibel Ábrego** — Libre Postulación / luego Panameñista, circuito 8-2
- **Zulay Rodríguez** — PRD, San Miguelito
- **Raúl Pineda** — PRD, San Miguelito
- **Dalia Bernal** — CD, San Miguelito
- **Ana Matilde Gómez** — Libre Postulación (diputada más votada en 2014)
- **Leandro Ávila** — PRD, San Miguelito
- **Crispiano Adames Navarro** — PRD, Ciudad de Panamá
- **José Blandón Figueroa** — PAN, Ciudad de Panamá
- **Katleen Levy** — PAN
- **Luis Barría** — PAN
- **Alcibíades Vásquez** — PAN / luego Libre Postulación

---

### 3.5 Diputados 2019–2024

*Lista parcial de diputados destacados:*

- **Juan Diego Vásquez** — Libre Postulación (diputado más votado, circuito 8-6, San Miguelito), 22 años al ser elegido
- **Zulay Rodríguez** — PRD, San Miguelito (reelecta)
- **Raúl Pineda** — PRD, San Miguelito (reelecto)
- **Dalia Bernal** — CD, San Miguelito (reelecta)
- **Leandro Ávila** — PRD, San Miguelito (reelecto por residuo)
- **Itzi Nailyn Atencio** — PAN, San Miguelito
- **Francisco Alemán** — MOLIRENA, San Miguelito (reelecto por residuo)
- **Cenobia Vargas** — PRD, circuito 8-10
- **Elías Vigil** — PAN, circuito 8-10
- **Alain Cedeño** — CD, circuito 8-10
- **Edwin Zúñiga** — CD, circuito 8-10

---

### 3.6 Diputados 2024–2029

*Datos iniciales disponibles; la composición completa puede consultarse en espaciocivico.org.*

- La Asamblea se caracterizó por alta fragmentación y un bloque independiente significativo
- **RM (Realizando Metas)** obtuvo mayoría relativa
- Múltiples diputados independientes (libre postulación)
- El partido panameñista obtuvo representación notable

---

## 4. Alcaldes — Municipio de Panamá (Ciudad de Panamá)

| Período | Alcalde | Partido |
|---------|--------|---------|
| 1999–2004 | Juan Díaz (aprox.) | — |
| 2004–2009 | Juan Carlos Navarro | PRD |
| 2009–2014 | Roberto Velásquez Wilson | CD |
| 2014–2019 | José Isabel Blandón Figueroa | PAN |
| 2019–2024 | José Luis "Popi" Fábrega | PRD |
| 2024–2029 | Olmedo Arcia | PRD |

---

## 5. Alcaldes — Municipio de San Miguelito

| Período | Alcalde | Partido |
|---------|--------|---------|
| 1999–2004 | — | — |
| 2004–2009 | Mayín Correa | PRD |
| 2009–2014 | Héctor Brands | CD |
| 2014–2019 | Guido Rodríguez | PAN |
| 2019–2024 | Héctor Brands | CD (reelecto) |
| 2024–2029 | (verificar) | — |

---

## 6. Otros funcionarios electos destacados

### Gobernadores de Provincia
*(Son designados por el Ejecutivo, no electos — pero son funcionarios de gobierno relevantes)*

| Provincia | Gobernador notable (período aprox.) |
|----------|-------------------------------------|
| Panamá | Sheyla Grajales (2019, también ministra brevemente) |
| Chiriquí | (varios) |
| Coclé | (varios) |
| Colón | (varios) |
| Herrera | (varios) |
| Los Santos | (varios) |
| Veraguas | (varios) |
| Darién | (varios) |
| Bocas del Toro | (varios) |

---

## 7. Notas sobre el Sistema Político Panameño

- **No existe Senado en Panamá.** El Poder Legislativo es unicameral: **Asamblea Nacional** con 71 diputados.
- Las elecciones generales se celebran cada 5 años; la siguiente es en mayo de 2029.
- Los alcaldes (en Panamá hay un alcalde por cada uno de los 77 distritos) son electos popularmente cada 5 años.
- Los **representantes de corregimiento** son también electos popularmente; cada uno de los ~679 corregimientos elige su representante. Esta lista no los incluye por su extensión, pero son también "elected officials."
- Los **gobernadores** son designados por el presidente, no electos.
- Partidos principales desde los 2000s: **PRD**, **Arnulfista/Panameñista**, **Cambio Democrático (CD)**, **MOLIRENA**, **Partido Popular (ex PDC)**, **Libre Postulación (independientes)**.

