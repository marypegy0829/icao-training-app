
-- ==============================================================================
-- ICAO Level 5 Examiner - 100 Global Airports Seed
-- Covers: Top 100 busiest/major hubs by region.
-- Includes: Runways, Frequencies, SIDs/STARs (Representative), Taxi Routes.
-- ==============================================================================

-- Ensure Table Structure
CREATE SCHEMA IF NOT EXISTS icao5_trainer;
CREATE TABLE IF NOT EXISTS icao5_trainer.airports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    icao_code TEXT UNIQUE NOT NULL,
    iata_code TEXT,
    name TEXT NOT NULL,
    city TEXT,
    country TEXT,
    region_code TEXT,
    elevation_ft INTEGER,
    image_url TEXT,
    runways JSONB,
    frequencies JSONB,
    procedures JSONB,
    taxi_routes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Batch Insert (Using UPSERT)
INSERT INTO icao5_trainer.airports (icao_code, iata_code, name, city, country, region_code, elevation_ft, runways, frequencies, procedures, taxi_routes)
VALUES 

-- ==============================================================================
-- 1. NORTH AMERICA (USA/Canada/Mexico)
-- ==============================================================================
('KATL', 'ATL', 'Hartsfield-Jackson', 'Atlanta', 'USA', 'K', 1026, '["08L/26R", "08R/26L", "09L/27R", "09R/27L", "10/28"]', '{"TOWER": "119.1", "APP": "127.9"}', '{"sids": ["ATL7", "BANNG2"], "stars": ["OZZZI1", "JJEDI2"]}', '{"Gate to 27R": "Dixie, Lima"}'),
('KLAX', 'LAX', 'Los Angeles Intl', 'Los Angeles', 'USA', 'K', 128, '["06L/24R", "06R/24L", "07L/25R", "07R/25L"]', '{"TOWER": "120.95", "APP": "124.3"}', '{"sids": ["ORCKA5", "GARDY2"], "stars": ["IRNMN2", "RYDRR2"]}', '{"Gate to 25R": "Charlie, Hold Short 25L"}'),
('KORD', 'ORD', 'O''Hare Intl', 'Chicago', 'USA', 'K', 668, '["09L/27R", "09R/27L", "10L/28R", "10C/28C", "04L/22R"]', '{"TOWER": "120.75", "APP": "119.0"}', '{"sids": ["ORD8", "EEONS3"], "stars": ["WATSN4", "FYTTE7"]}', '{"Gate to 28R": "Alpha, Bravo"}'),
('KDFW', 'DFW', 'Dallas/Fort Worth', 'Dallas', 'USA', 'K', 607, '["17C/35C", "17R/35L", "18L/36R", "13R/31L"]', '{"TOWER": "126.55", "APP": "123.9"}', '{"sids": ["AKUNA6", "JPOOL6"], "stars": ["FINGR9", "WHINZ4"]}', '{"Gate to 35L": "Kilo, Hotel"}'),
('KDEN', 'DEN', 'Denver Intl', 'Denver', 'USA', 'K', 5434, '["07/25", "08/26", "16L/34R", "16R/34L", "17L/35R"]', '{"TOWER": "118.75", "APP": "120.35"}', '{"sids": ["DEN8", "PIKES2"], "stars": ["DANDD1", "LARKS2"]}', '{"Gate to 34L": "Mike, Alpha"}'),
('KJFK', 'JFK', 'John F. Kennedy', 'New York', 'USA', 'K', 13, '["04L/22R", "04R/22L", "13L/31R", "13R/31L"]', '{"TOWER": "119.1", "APP": "127.4"}', '{"sids": ["KENNEDY5", "BETTE3"], "stars": ["LENDY6", "CAMRN4"]}', '{"Gate to 22R": "Alpha, Bravo, Hold Short 22L"}'),
('KSFO', 'SFO', 'San Francisco', 'San Francisco', 'USA', 'K', 13, '["01L/19R", "01R/19L", "10L/28R", "10R/28L"]', '{"TOWER": "120.5", "APP": "134.5"}', '{"sids": ["SFO8", "GAP7"], "stars": ["SERFR4", "BDEGA3"]}', '{"Gate to 01R": "Alpha, Cross 28L"}'),
('KMCO', 'MCO', 'Orlando Intl', 'Orlando', 'USA', 'K', 96, '["17L/35R", "17R/35L", "18L/36R", "18R/36L"]', '{"TOWER": "118.45", "APP": "120.15"}', '{"sids": ["ORL4", "JAG6"], "stars": ["BITHO7", "GOOFY7"]}', '{"Gate to 36R": "Bravo, Hotel"}'),
('KLAS', 'LAS', 'Harry Reid', 'Las Vegas', 'USA', 'K', 2181, '["01L/19R", "01R/19L", "08L/26R", "08R/26L"]', '{"TOWER": "119.9", "APP": "125.6"}', '{"sids": ["LAS5", "HOOVER6"], "stars": ["GRNPA2", "LUXOR2"]}', '{"Gate to 26R": "Alpha, Whiskey"}'),
('KSEA', 'SEA', 'Seattle-Tacoma', 'Seattle', 'USA', 'K', 433, '["16L/34R", "16C/34C", "16R/34L"]', '{"TOWER": "119.9", "APP": "120.1"}', '{"sids": ["SEA8", "ELMAA4"], "stars": ["CHINS4", "HAWKZ6"]}', '{"Gate to 34R": "Bravo, Tango"}'),
('KCLT', 'CLT', 'Charlotte Douglas', 'Charlotte', 'USA', 'K', 748, '["18C/36C", "18L/36R", "18R/36L"]', '{"TOWER": "118.1", "APP": "120.05"}', '{"sids": ["CLT3", "ICONS4"], "stars": ["FILPZ3", "MAJIC4"]}', '{"Gate to 36C": "Mike, Echo"}'),
('KEWR', 'EWR', 'Newark Liberty', 'Newark', 'USA', 'K', 18, '["04L/22R", "04R/22L", "11/29"]', '{"TOWER": "118.3", "APP": "128.55"}', '{"sids": ["EWR4", "PORTT4"], "stars": ["JAIKE4", "PHLBO4"]}', '{"Gate to 22R": "Zulu, Hold Short 22L"}'),
('KPHX', 'PHX', 'Phoenix Sky Harbor', 'Phoenix', 'USA', 'K', 1135, '["07L/25R", "07R/25L", "08/26"]', '{"TOWER": "118.7", "APP": "120.7"}', '{"sids": ["PHX7", "ECLPS1"], "stars": ["ARLIN4", "DSERT2"]}', '{"Gate to 26": "Charlie, Delta"}'),
('KIAH', 'IAH', 'George Bush', 'Houston', 'USA', 'K', 97, '["08L/26R", "08R/26L", "09/27", "15L/33R"]', '{"TOWER": "120.725", "APP": "120.05"}', '{"sids": ["IAH8", "LURIC2"], "stars": ["DOOBI2", "GRIZZ2"]}', '{"Gate to 15L": "Kilo, November"}'),
('KMIA', 'MIA', 'Miami Intl', 'Miami', 'USA', 'K', 8, '["08L/26R", "08R/26L", "09/27", "12/30"]', '{"TOWER": "118.3", "APP": "124.85"}', '{"sids": ["MIA9", "SKIPS2"], "stars": ["CYY1", "FLL1"]}', '{"Gate to 09": "Q, Hold Short 12"}'),
('KBOS', 'BOS', 'Logan Intl', 'Boston', 'USA', 'K', 20, '["04L/22R", "04R/22L", "09/27", "15R/33L"]', '{"TOWER": "128.8", "APP": "120.6"}', '{"sids": ["LOGAN7", "HYLND6"], "stars": ["OOSHN5", "ROBUC3"]}', '{"Gate to 22R": "Kilo, Alpha"}'),
('KDTW', 'DTW', 'Detroit Metro', 'Detroit', 'USA', 'K', 645, '["03L/21R", "03R/21L", "04L/22R", "04R/22L"]', '{"TOWER": "118.4", "APP": "124.05"}', '{"sids": ["DTW4", "METRO3"], "stars": ["KAYLN2", "VCTR2"]}', '{"Gate to 21L": "Foxtrot, Hold Short 22R"}'),
('KMSP', 'MSP', 'Minneapolis-St Paul', 'Minneapolis', 'USA', 'K', 841, '["12L/30R", "12R/30L", "17/35"]', '{"TOWER": "123.95", "APP": "119.3"}', '{"sids": ["MSP6", "COULT6"], "stars": ["KASPR6", "NITZ6"]}', '{"Gate to 30L": "Charlie, Delta"}'),
('PHNL', 'HNL', 'Daniel K. Inouye', 'Honolulu', 'USA', 'P', 13, '["04L/22R", "04R/22L", "08L/26R", "08R/26L"]', '{"TOWER": "118.1", "APP": "118.3"}', '{"sids": ["KEOLA4", "MOLOKAI4"], "stars": ["JULIE5", "OPANA4"]}', '{"Gate to 08R": "Reef Runway Taxiway"}'),
('PAFA', 'FAI', 'Fairbanks', 'Fairbanks', 'USA', 'P', 439, '["02L/20R", "02R/20L"]', '{"TOWER": "118.3", "APP": "125.35"}', '{"sids": ["PUYALLUP3"], "stars": ["NORTH POLE"]}', '{"Gate to 20R": "Taxi Bravo"}'),
('CYYZ', 'YYZ', 'Toronto Pearson', 'Toronto', 'Canada', 'C', 569, '["05/23", "06L/24R", "06R/24L", "15L/33R"]', '{"TOWER": "118.35", "APP": "124.47"}', '{"sids": ["DEDKI4", "EBKIX4"], "stars": ["BOXUM4", "LINNG4"]}', '{"Gate to 23": "Hotel, Hold Short 33R"}'),
('CYVR', 'YVR', 'Vancouver', 'Vancouver', 'Canada', 'C', 14, '["08L/26R", "08R/26L"]', '{"TOWER": "118.7", "APP": "126.8"}', '{"sids": ["RICHM6", "VR7"], "stars": ["GRIZZ7", "CANUK7"]}', '{"Gate to 08R": "Mike, Lima"}'),
('CYUL', 'YUL', 'Montreal-Trudeau', 'Montreal', 'Canada', 'C', 118, '["06L/24R", "06R/24L"]', '{"TOWER": "119.9", "APP": "124.65"}', '{"sids": ["KANUR4", "OMTOX4"], "stars": ["HABBS4", "LOKBU4"]}', '{"Gate to 24L": "Alpha, Hold Short 06L"}'),
('MMMX', 'MEX', 'Benito Juarez', 'Mexico City', 'Mexico', 'M', 7316, '["05L/23R", "05R/23L"]', '{"TOWER": "118.1", "APP": "121.2"}', '{"sids": ["TLC2A", "PTJ2A"], "stars": ["MEX2A", "SLM2A"]}', '{"Gate to 05R": "Bravo"}'),
('MMUN', 'CUN', 'Cancun', 'Cancun', 'Mexico', 'M', 20, '["12L/30R", "12R/30L"]', '{"TOWER": "118.6", "APP": "120.4"}', '{"sids": ["CUN1A", "CUN2B"], "stars": ["OSUP1A", "KOBE1A"]}', '{"Gate to 12L": "Alpha"}'),

-- ==============================================================================
-- 2. EUROPE
-- ==============================================================================
('EGLL', 'LHR', 'London Heathrow', 'London', 'UK', 'E', 83, '["09L/27R", "09R/27L"]', '{"TOWER": "118.5", "APP": "120.4"}', '{"sids": ["DET6G", "MAY2F"], "stars": ["BIG2E", "OCK2E"]}', '{"Gate to 27R": "Alpha, Hold Short A10"}'),
('EGKK', 'LGW', 'London Gatwick', 'London', 'UK', 'E', 196, '["08R/26L"]', '{"TOWER": "124.225", "APP": "126.825"}', '{"sids": ["LAM4M", "CLN5M"], "stars": ["TIMBA2C", "WILLO3D"]}', '{"Gate to 26L": "Juliet, Hold Short Runway"}'),
('LFPG', 'CDG', 'Charles de Gaulle', 'Paris', 'France', 'L', 392, '["08L/26R", "08R/26L", "09L/27R", "09R/27L"]', '{"TOWER": "120.9", "APP": "118.1"}', '{"sids": ["OKIPA5A", "AGOPA5A"], "stars": ["MOPAR5W", "VEBEK5W"]}', '{"Gate to 26R": "Quebec"}'),
('EHAM', 'AMS', 'Schiphol', 'Amsterdam', 'Netherlands', 'E', -11, '["18R/36L", "18C/36C", "18L/36R", "06/24", "09/27"]', '{"TOWER": "119.225", "APP": "121.2"}', '{"sids": ["ANDIK2S", "LOPIK2S"], "stars": ["ARTIP2A", "SUGOL2A"]}', '{"Gate to 36L": "Quebec, Cross 24"}'),
('EDDF', 'FRA', 'Frankfurt', 'Frankfurt', 'Germany', 'E', 364, '["07C/25C", "07R/25L", "18/36"]', '{"TOWER": "119.9", "APP": "120.8"}', '{"sids": ["ANEKI3F", "CINDY3F"], "stars": ["KERAX2A", "ROLIS2A"]}', '{"Gate to 18": "November, Hold Short 25C"}'),
('EDDM', 'MUC', 'Munich', 'Munich', 'Germany', 'E', 1487, '["08L/26R", "08R/26L"]', '{"TOWER": "118.7", "APP": "123.9"}', '{"sids": ["ANORA3A", "BIBAG3A"], "stars": ["BETOS2A", "LANDU2A"]}', '{"Gate to 26L": "Sierra"}'),
('LEMD', 'MAD', 'Barajas', 'Madrid', 'Spain', 'L', 2000, '["14L/32R", "14R/32L", "18L/36R", "18R/36L"]', '{"TOWER": "118.15", "APP": "127.5"}', '{"sids": ["PINAR2R", "RBO2R"], "stars": ["PRADO2A", "TOLSO2A"]}', '{"Gate to 36L": "Mike, Cross 32R"}'),
('LEBL', 'BCN', 'El Prat', 'Barcelona', 'Spain', 'L', 14, '["07L/25R", "07R/25L", "02/20"]', '{"TOWER": "118.325", "APP": "119.1"}', '{"sids": ["LOBAR3A", "SLL3A"], "stars": ["ASTRO1A", "VIBIM1A"]}', '{"Gate to 25L": "Kilo, Echo"}'),
('LIRF', 'FCO', 'Fiumicino', 'Rome', 'Italy', 'L', 15, '["16L/34R", "16R/34L", "07/25"]', '{"TOWER": "118.7", "APP": "119.2"}', '{"sids": ["ELBA5A", "GILIO5A"], "stars": ["BOL1A", "LAT1A"]}', '{"Gate to 25": "Alpha, Bravo"}'),
('LIMC', 'MXP', 'Malpensa', 'Milan', 'Italy', 'L', 767, '["17L/35R", "17R/35L"]', '{"TOWER": "119.0", "APP": "126.3"}', '{"sids": ["SRN6A", "VOG6A"], "stars": ["MOLUS1A", "ABESI1A"]}', '{"Gate to 35L": "Tango, Whiskey"}'),
('LSZH', 'ZRH', 'Zurich', 'Zurich', 'Switzerland', 'L', 1416, '["10/28", "14/32", "16/34"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["DEGES2W", "SULNO2W"], "stars": ["GIPOL2A", "RILAX2A"]}', '{"Gate to 28": "Echo, Cross 16"}'),
('LOWW', 'VIE', 'Vienna Intl', 'Vienna', 'Austria', 'L', 600, '["11/29", "16/34"]', '{"TOWER": "119.4", "APP": "128.2"}', '{"sids": ["SASAL2C", "SOVIL2C"], "stars": ["MASUR2A", "NIMDU2A"]}', '{"Gate to 29": "Mike"}'),
('EBBR', 'BRU', 'Brussels', 'Brussels', 'Belgium', 'E', 184, '["01/19", "07L/25R", "07R/25L"]', '{"TOWER": "118.6", "APP": "118.25"}', '{"sids": ["CIV3C", "DENUT3C"], "stars": ["ANT3A", "FLO3A"]}', '{"Gate to 25R": "Inner 4"}'),
('EKCH', 'CPH', 'Kastrup', 'Copenhagen', 'Denmark', 'E', 17, '["04L/22R", "04R/22L", "12/30"]', '{"TOWER": "118.1", "APP": "119.8"}', '{"sids": ["KEMAX1A", "SIMEG1A"], "stars": ["TUDLO1A", "KOR1A"]}', '{"Gate to 22L": "A, B"}'),
('ENGM', 'OSL', 'Gardermoen', 'Oslo', 'Norway', 'E', 681, '["01L/19R", "01R/19L"]', '{"TOWER": "118.3", "APP": "119.65"}', '{"sids": ["TOR1A", "VIPA1A"], "stars": ["SIG1A", "TIT1A"]}', '{"Gate to 01L": "Mike"}'),
('ESSA', 'ARN', 'Arlanda', 'Stockholm', 'Sweden', 'E', 137, '["01L/19R", "01R/19L", "08/26"]', '{"TOWER": "118.5", "APP": "123.75"}', '{"sids": ["AROS1A", "NILUG1A"], "stars": ["HMR1A", "XILAN1A"]}', '{"Gate to 01L": "Y"}'),
('EFHK', 'HEL', 'Vantaa', 'Helsinki', 'Finland', 'E', 179, '["04L/22R", "04R/22L", "15/33"]', '{"TOWER": "118.6", "APP": "119.9"}', '{"sids": ["LAKUT1A", "RENKU1A"], "stars": ["ADIVO1A", "VEKIN1A"]}', '{"Gate to 22L": "Y"}'),
('EIDW', 'DUB', 'Dublin', 'Dublin', 'Ireland', 'E', 242, '["10/28", "16/34"]', '{"TOWER": "118.6", "APP": "121.1"}', '{"sids": ["LIFFY1A", "BOGG1A"], "stars": ["OSGAR1A", "LAPMO1A"]}', '{"Gate to 28": "E1, Link 4"}'),
('LTFM', 'IST', 'Istanbul', 'Istanbul', 'Turkey', 'L', 325, '["16L/34R", "16R/34L", "17L/35R", "17R/35L", "18/36"]', '{"TOWER": "118.1", "APP": "120.5"}', '{"sids": ["IST1A", "OSME1A"], "stars": ["ERKU1A", "IST2A"]}', '{"Gate to 35L": "Golf, Juliet"}'),
('LGAV', 'ATH', 'Eleftherios Venizelos', 'Athens', 'Greece', 'L', 308, '["03L/21R", "03R/21L"]', '{"TOWER": "118.1", "APP": "124.025"}', '{"sids": ["KEA1A", "SOTA1A"], "stars": ["AIG1A", "PIK1A"]}', '{"Gate to 03R": "Alpha"}'),
('LPPT', 'LIS', 'Humberto Delgado', 'Lisbon', 'Portugal', 'L', 374, '["03/21", "17/35"]', '{"TOWER": "118.1", "APP": "119.1"}', '{"sids": ["FATI1A", "IXID1A"], "stars": ["ODL1A", "XAM1A"]}', '{"Gate to 03": "Mike, November"}'),
('UUEE', 'SVO', 'Sheremetyevo', 'Moscow', 'Russia', 'U', 630, '["06L/24R", "06R/24L", "06C/24C"]', '{"TOWER": "118.1", "APP": "125.5"}', '{"sids": ["UM1A", "KN1A"], "stars": ["OKL1A", "SW1A"]}', '{"Gate to 24C": "Main Taxiway"}'),
('UUDD', 'DME', 'Domodedovo', 'Moscow', 'Russia', 'U', 588, '["14L/32R", "14R/32L"]', '{"TOWER": "119.7", "APP": "127.7"}', '{"sids": ["DK1A", "GE1A"], "stars": ["VIN1A", "WT1A"]}', '{"Gate to 32L": "Mike"}'),
('ULLI', 'LED', 'Pulkovo', 'St Petersburg', 'Russia', 'U', 78, '["10L/28R", "10R/28L"]', '{"TOWER": "118.1", "APP": "125.2"}', '{"sids": ["KR1A", "LIS1A"], "stars": ["GOG1A", "LUN1A"]}', '{"Gate to 28L": "Alpha"}'),
('BIKF', 'KEF', 'Keflavik', 'Reykjavik', 'Iceland', 'B', 171, '["01/19", "10/28"]', '{"TOWER": "118.3", "APP": "119.3"}', '{"sids": ["GARD1A", "REYK1A"], "stars": ["ELVU1A", "MOS1A"]}', '{"Gate to 19": "Kilo"}'),

-- ==============================================================================
-- 3. ASIA (East/SE/South/Central)
-- ==============================================================================
('ZBAA', 'PEK', 'Beijing Capital', 'Beijing', 'China', 'Z', 116, '["36R/18L", "36L/18R", "01/19"]', '{"TOWER": "118.1", "APP": "119.0"}', '{"sids": ["LADIX7D", "DOTRA7D"], "stars": ["DUMET1A", "IGMOR1A"]}', '{"Gate to 36R": "Whiskey 1, Hold Short 36L"}'),
('ZSPD', 'PVG', 'Shanghai Pudong', 'Shanghai', 'China', 'Z', 13, '["17L/35R", "17R/35L", "16L/34R", "16R/34L"]', '{"TOWER": "118.5", "APP": "120.3"}', '{"sids": ["AND11D", "VET11D"], "stars": ["OLK11A", "SAS13A"]}', '{"Gate to 35R": "Bravo, Hold Short 35L"}'),
('ZGGG', 'CAN', 'Guangzhou Baiyun', 'Guangzhou', 'China', 'Z', 50, '["01/19", "02L/20R", "02R/20L"]', '{"TOWER": "118.1", "APP": "120.4"}', '{"sids": ["IGG1A", "SHL1A"], "stars": ["LMN1A", "YIN1A"]}', '{"Gate to 02L": "Alpha"}'),
('VHHH', 'HKG', 'Hong Kong Intl', 'Hong Kong', 'China', 'V', 28, '["07L/25R", "07R/25L", "07C/25C"]', '{"TOWER": "118.7", "APP": "119.1"}', '{"sids": ["BEKOL3A", "LAKES3A"], "stars": ["ABBEY3A", "BETTY2A"]}', '{"Gate to 07R": "Hotel, Cross 07C"}'),
('RCTP', 'TPE', 'Taoyuan', 'Taipei', 'Taiwan', 'R', 108, '["05L/23R", "05R/23L"]', '{"TOWER": "118.7", "APP": "125.1"}', '{"sids": ["DRAKE1A", "KIKU1A"], "stars": ["JAMMY1A", "TONY1A"]}', '{"Gate to 05L": "North Cross"}'),
('RJTT', 'HND', 'Tokyo Haneda', 'Tokyo', 'Japan', 'R', 21, '["16L/34R", "16R/34L", "04/22", "05/23"]', '{"TOWER": "118.1", "APP": "119.1"}', '{"sids": ["JYOGA2", "SEKID2"], "stars": ["ARLON1", "CREAM1"]}', '{"Gate to 16R": "Romeo, Hold Short 16L"}'),
('RJAA', 'NRT', 'Narita', 'Tokyo', 'Japan', 'R', 135, '["16L/34R", "16R/34L"]', '{"TOWER": "118.2", "APP": "124.4"}', '{"sids": ["TETRA8", "GULPO8"], "stars": ["LUBLA1", "SWAMP1"]}', '{"Gate to 34L": "Alpha"}'),
('RJBB', 'KIX', 'Kansai', 'Osaka', 'Japan', 'R', 17, '["06L/24R", "06R/24L"]', '{"TOWER": "118.2", "APP": "120.45"}', '{"sids": ["MAIKO1", "TOMO1"], "stars": ["ALISA1", "BERRY1"]}', '{"Gate to 06R": "Papa"}'),
('RKSI', 'ICN', 'Incheon Intl', 'Seoul', 'South Korea', 'R', 23, '["15L/33R", "15R/33L", "16/34"]', '{"TOWER": "118.2", "APP": "119.75"}', '{"sids": ["BOPTA2A", "NOPIK2A"], "stars": ["GUKDO1A", "OLMEN1A"]}', '{"Gate to 33L": "Romeo 1"}'),
('WSSS', 'SIN', 'Singapore Changi', 'Singapore', 'Singapore', 'W', 22, '["02L/20R", "02C/20C", "02R/20L"]', '{"TOWER": "118.6", "APP": "120.3"}', '{"sids": ["MIPAK1", "VENTO1"], "stars": ["LAVAX1", "PASPU1"]}', '{"Gate to 20C": "EP, Cross 20R"}'),
('WMKK', 'KUL', 'Kuala Lumpur', 'Kuala Lumpur', 'Malaysia', 'W', 70, '["14L/32R", "14R/32L", "15/33"]', '{"TOWER": "118.8", "APP": "119.45"}', '{"sids": ["AGOSA1A", "KIDOT1A"], "stars": ["DAKUS1A", "GUKAM1A"]}', '{"Gate to 32R": "Alpha"}'),
('VTBS', 'BKK', 'Suvarnabhumi', 'Bangkok', 'Thailand', 'V', 5, '["01L/19R", "01R/19L"]', '{"TOWER": "118.1", "APP": "125.2"}', '{"sids": ["REGOS2A", "UKERA2A"], "stars": ["ALBOS1A", "BATOK1A"]}', '{"Gate to 19L": "Alpha"}'),
('WIII', 'CGK', 'Soekarno-Hatta', 'Jakarta', 'Indonesia', 'W', 34, '["07L/25R", "07R/25L", "06/24"]', '{"TOWER": "118.2", "APP": "119.75"}', '{"sids": ["KAMAL1A", "REKLA1A"], "stars": ["DOLTA1A", "ESALA1A"]}', '{"Gate to 25R": "North Parallel"}'),
('RPLL', 'MNL', 'Ninoy Aquino', 'Manila', 'Philippines', 'R', 75, '["06/24", "13/31"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["IPATA1A", "MIA1A"], "stars": ["CAB1A", "LUB1A"]}', '{"Gate to 06": "Charlie"}'),
('VVTS', 'SGN', 'Tan Son Nhat', 'Ho Chi Minh', 'Vietnam', 'V', 33, '["07L/25R", "07R/25L"]', '{"TOWER": "118.1", "APP": "125.5"}', '{"sids": ["ANLOC1A", "VILAO1A"], "stars": ["EAST1A", "WEST1A"]}', '{"Gate to 25L": "E1"}'),
('VIDP', 'DEL', 'Indira Gandhi', 'New Delhi', 'India', 'V', 777, '["11/29", "10/28", "09L/27R", "09R/27L"]', '{"TOWER": "118.1", "APP": "124.2"}', '{"sids": ["ALI2A", "BUTOP2A"], "stars": ["AKBAR1A", "GURSI1A"]}', '{"Gate to 29": "CW, Hold Short 28"}'),
('VABB', 'BOM', 'Chhatrapati Shivaji', 'Mumbai', 'India', 'V', 39, '["09/27", "14/32"]', '{"TOWER": "118.1", "APP": "127.9"}', '{"sids": ["DIPAS1A", "MABTA1A"], "stars": ["AKTIV1A", "ELR1A"]}', '{"Gate to 27": "November, Hold Short 14"}'),
('VOBL', 'BLR', 'Kempegowda', 'Bangalore', 'India', 'V', 3000, '["09L/27R", "09R/27L"]', '{"TOWER": "118.65", "APP": "121.25"}', '{"sids": ["ANI1A", "VAB1A"], "stars": ["DOG1A", "SAI1A"]}', '{"Gate to 09L": "Alpha"}'),
('VOMM', 'MAA', 'Chennai', 'Chennai', 'India', 'V', 52, '["07/25", "12/30"]', '{"TOWER": "118.1", "APP": "127.9"}', '{"sids": ["MMV1A", "KOL1A"], "stars": ["TAP1A", "BOD1A"]}', '{"Gate to 07": "Bravo"}'),
('UTTT', 'TAS', 'Tashkent', 'Tashkent', 'Uzbekistan', 'U', 1417, '["08L/26R", "08R/26L"]', '{"TOWER": "120.4", "APP": "125.2"}', '{"sids": ["TAS1A", "DIL1A"], "stars": ["GUS1A", "KUB1A"]}', '{"Gate to 08L": "Alpha"}'),
('UAAA', 'ALA', 'Almaty', 'Almaty', 'Kazakhstan', 'U', 2231, '["05L/23R", "05R/23L"]', '{"TOWER": "119.4", "APP": "124.8"}', '{"sids": ["BAL1A", "RAK1A"], "stars": ["OLK1A", "TIG1A"]}', '{"Gate to 05L": "A"}'),
('UBBB', 'GYD', 'Heydar Aliyev', 'Baku', 'Azerbaijan', 'U', 10, '["16/34", "17/35"]', '{"TOWER": "118.1", "APP": "125.1"}', '{"sids": ["BAK1A", "NOR1A"], "stars": ["SIT1A", "KOR1A"]}', '{"Gate to 34": "Alpha"}'),
('UGTB', 'TBS', 'Tbilisi', 'Tbilisi', 'Georgia', 'U', 1624, '["13L/31R", "13R/31L"]', '{"TOWER": "118.7", "APP": "120.7"}', '{"sids": ["TBS1A", "NAT1A"], "stars": ["GEO1A", "RUS1A"]}', '{"Gate to 31L": "Alpha"}'),
('UDYZ', 'EVN', 'Zvartnots', 'Yerevan', 'Armenia', 'U', 2838, '["09/27"]', '{"TOWER": "120.8", "APP": "126.0"}', '{"sids": ["YEV1A", "SEV1A"], "stars": ["ARM1A", "TAB1A"]}', '{"Gate to 09": "Alpha"}'),
('OPKC', 'KHI', 'Jinnah', 'Karachi', 'Pakistan', 'O', 100, '["07L/25R", "07R/25L"]', '{"TOWER": "118.1", "APP": "125.5"}', '{"sids": ["KHI1A", "IND1A"], "stars": ["PAK1A", "ARA1A"]}', '{"Gate to 25L": "Alpha"}'),

-- ==============================================================================
-- 4. MIDDLE EAST (Gulf/Levant)
-- ==============================================================================
('OMDB', 'DXB', 'Dubai Intl', 'Dubai', 'UAE', 'O', 62, '["12L/30R", "12R/30L"]', '{"TOWER": "118.75", "APP": "124.9"}', '{"sids": ["MIADA3F", "NABIX2F"], "stars": ["DESDI2A", "KUVOT2A"]}', '{"Gate to 30R": "Mike, Hold Short 30L"}'),
('OMAA', 'AUH', 'Abu Dhabi Intl', 'Abu Dhabi', 'UAE', 'O', 88, '["13L/31R", "13R/31L"]', '{"TOWER": "118.1", "APP": "124.4"}', '{"sids": ["VUTAN1A", "ROVOS1A"], "stars": ["LUVAR1A", "MUVLA1A"]}', '{"Gate to 31L": "Alpha"}'),
('OTHH', 'DOH', 'Hamad Intl', 'Doha', 'Qatar', 'O', 13, '["16L/34R", "16R/34L"]', '{"TOWER": "118.05", "APP": "121.1"}', '{"sids": ["ALVEN1D", "MUSEX1D"], "stars": ["BAYAN1A", "GINTO1A"]}', '{"Gate to 34L": "Bravo"}'),
('OERK', 'RUH', 'King Khalid', 'Riyadh', 'Saudi Arabia', 'O', 2049, '["15L/33R", "15R/33L"]', '{"TOWER": "118.1", "APP": "120.0"}', '{"sids": ["KIKK1A", "SAL1A"], "stars": ["RIY1A", "DAN1A"]}', '{"Gate to 33L": "Alpha"}'),
('OEJN', 'JED', 'King Abdulaziz', 'Jeddah', 'Saudi Arabia', 'O', 48, '["16L/34R", "16C/34C", "16R/34L"]', '{"TOWER": "118.2", "APP": "124.2"}', '{"sids": ["JED1A", "MEK1A"], "stars": ["HJJ1A", "ZAM1A"]}', '{"Gate to 34C": "Bravo"}'),
('OBBI', 'BAH', 'Bahrain Intl', 'Bahrain', 'Bahrain', 'O', 6, '["12L/30R"]', '{"TOWER": "118.1", "APP": "127.85"}', '{"sids": ["BAH1A", "SIT1A"], "stars": ["MAN1A", "GUL1A"]}', '{"Gate to 30R": "Alpha"}'),
('OKBK', 'KWI', 'Kuwait Intl', 'Kuwait City', 'Kuwait', 'O', 206, '["15L/33R", "15R/33L"]', '{"TOWER": "118.3", "APP": "120.4"}', '{"sids": ["KWI1A", "JAH1A"], "stars": ["SAL1A", "KUW1A"]}', '{"Gate to 33R": "Echo"}'),
('OOMS', 'MCT', 'Muscat Intl', 'Muscat', 'Oman', 'O', 15, '["08L/26R", "08R/26L"]', '{"TOWER": "118.1", "APP": "124.0"}', '{"sids": ["MCT1A", "SEE1A"], "stars": ["NIZ1A", "OMA1A"]}', '{"Gate to 08L": "Alpha"}'),
('OJAI', 'AMM', 'Queen Alia', 'Amman', 'Jordan', 'O', 2395, '["08L/26R", "08R/26L"]', '{"TOWER": "118.1", "APP": "127.7"}', '{"sids": ["AMMAN2A", "ELMER1A"], "stars": ["SALAM2A", "LUNAR1A"]}', '{"Gate to 08R": "Alpha"}'),
('LLBG', 'TLV', 'Ben Gurion', 'Tel Aviv', 'Israel', 'L', 135, '["08/26", "12/30", "03/21"]', '{"TOWER": "118.1", "APP": "120.5"}', '{"sids": ["MER1A", "DEE1A"], "stars": ["PUL1A", "TAL1A"]}', '{"Gate to 26": "Kilo"}'),

-- ==============================================================================
-- 5. OCEANIA (Australia/NZ/Pacific)
-- ==============================================================================
('YSSY', 'SYD', 'Kingsford Smith', 'Sydney', 'Australia', 'Y', 21, '["16L/34R", "16R/34L", "07/25"]', '{"TOWER": "120.5", "APP": "124.4"}', '{"sids": ["KAMPI3", "FISHA2"], "stars": ["BOOGI1", "RIVET3"]}', '{"Gate to 34L": "Alpha, Hold Short 07"}'),
('YMML', 'MEL', 'Tullamarine', 'Melbourne', 'Australia', 'Y', 434, '["16/34", "09/27"]', '{"TOWER": "120.5", "APP": "132.0"}', '{"sids": ["DOSEL1", "ML2"], "stars": ["LIZZI5", "WOL2"]}', '{"Gate to 34": "Tango"}'),
('YBBN', 'BNE', 'Brisbane', 'Brisbane', 'Australia', 'Y', 13, '["01L/19R", "01R/19L"]', '{"TOWER": "120.1", "APP": "125.6"}', '{"sids": ["SANO1A", "BN2A"], "stars": ["GOL1A", "SUN1A"]}', '{"Gate to 01L": "Alpha"}'),
('YPPH', 'PER', 'Perth', 'Perth', 'Australia', 'Y', 67, '["03/21", "06/24"]', '{"TOWER": "120.5", "APP": "123.6"}', '{"sids": ["PER1A", "WAV1A"], "stars": ["JUL1A", "AUG1A"]}', '{"Gate to 21": "Charlie"}'),
('NZAA', 'AKL', 'Auckland', 'Auckland', 'New Zealand', 'N', 23, '["05R/23L"]', '{"TOWER": "118.7", "APP": "124.3"}', '{"sids": ["ADKOS2", "LENGU2"], "stars": ["AA2", "POLK2"]}', '{"Gate to 23L": "Bravo"}'),
('NZCH', 'CHC', 'Christchurch', 'Christchurch', 'New Zealand', 'N', 123, '["02/20", "11/29"]', '{"TOWER": "118.4", "APP": "120.9"}', '{"sids": ["CHC1A", "KAI1A"], "stars": ["MON1A", "TUE1A"]}', '{"Gate to 02": "Alpha"}'),
('NFFN', 'NAN', 'Nadi', 'Nadi', 'Fiji', 'N', 59, '["02/20", "09/27"]', '{"TOWER": "118.1", "APP": "119.1"}', '{"sids": ["NAN1A", "FIJ1A"], "stars": ["PAC1A", "ISL1A"]}', '{"Gate to 02": "Alpha"}'),

-- ==============================================================================
-- 6. SOUTH AMERICA (Brazil/Argentina/Chile/Colombia/Peru)
-- ==============================================================================
('SBGR', 'GRU', 'Guarulhos', 'Sao Paulo', 'Brazil', 'S', 2461, '["09L/27R", "09R/27L"]', '{"TOWER": "118.4", "APP": "119.8"}', '{"sids": ["PCO1A", "UKBE1A"], "stars": ["EDMU1A", "KUKU1A"]}', '{"Gate to 09L": "Echo, Hold Short 09R"}'),
('SBGL', 'GIG', 'Galeao', 'Rio de Janeiro', 'Brazil', 'S', 28, '["10/28", "15/33"]', '{"TOWER": "118.0", "APP": "119.0"}', '{"sids": ["RIO1A", "SAMBA1A"], "stars": ["CAR1A", "NIV1A"]}', '{"Gate to 10": "Alpha"}'),
('SBBR', 'BSB', 'Brasilia', 'Brasilia', 'Brazil', 'S', 3497, '["11L/29R", "11R/29L"]', '{"TOWER": "118.1", "APP": "119.2"}', '{"sids": ["BSB1A", "PLAN1A"], "stars": ["CAP1A", "FED1A"]}', '{"Gate to 11L": "Kilo"}'),
('SAEZ', 'EZE', 'Ezeiza', 'Buenos Aires', 'Argentina', 'S', 67, '["11/29", "17/35"]', '{"TOWER": "118.6", "APP": "119.6"}', '{"sids": ["EZE1A", "ARG1A"], "stars": ["TAN1A", "GOL1A"]}', '{"Gate to 11": "Alpha"}'),
('SCEL', 'SCL', 'Arturo Merino Benitez', 'Santiago', 'Chile', 'S', 1555, '["17L/35R", "17R/35L"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["AMB3A", "DUNG2A"], "stars": ["ELMO2A", "LINER1A"]}', '{"Gate to 17R": "Zulu"}'),
('SKBO', 'BOG', 'El Dorado', 'Bogota', 'Colombia', 'S', 8361, '["13L/31R", "13R/31L"]', '{"TOWER": "118.1", "APP": "119.5"}', '{"sids": ["BOG1A", "COL1A"], "stars": ["AND1A", "ES1A"]}', '{"Gate to 13L": "Alpha"}'),
('SPJC', 'LIM', 'Jorge Chavez', 'Lima', 'Peru', 'S', 113, '["15/33"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["LIM1A", "PER1A"], "stars": ["INC1A", "MAY1A"]}', '{"Gate to 15": "Bravo"}'),
('SEQM', 'UIO', 'Mariscal Sucre', 'Quito', 'Ecuador', 'S', 7910, '["18/36"]', '{"TOWER": "118.1", "APP": "119.3"}', '{"sids": ["QUI1A", "EQ1A"], "stars": ["VOL1A", "CAN1A"]}', '{"Gate to 36": "Alpha"}'),
('MPTO', 'PTY', 'Tocumen', 'Panama City', 'Panama', 'M', 135, '["03L/21R", "03R/21L"]', '{"TOWER": "118.1", "APP": "119.1"}', '{"sids": ["PAN1A", "CAN1A"], "stars": ["LOC1A", "SH1A"]}', '{"Gate to 03R": "Alpha"}'),

-- ==============================================================================
-- 7. AFRICA (North/South/East/West)
-- ==============================================================================
('FAOR', 'JNB', 'O.R. Tambo', 'Johannesburg', 'South Africa', 'F', 5558, '["03L/21R", "03R/21L"]', '{"TOWER": "118.1", "APP": "124.5"}', '{"sids": ["GEV1A", "LIV1A"], "stars": ["JS2A", "HB2A"]}', '{"Gate to 03L": "Alpha, Hold Short 03R"}'),
('FACT', 'CPT', 'Cape Town', 'Cape Town', 'South Africa', 'F', 151, '["01/19", "16/34"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["CPT1A", "TAB1A"], "stars": ["MTN1A", "SEA1A"]}', '{"Gate to 01": "Alpha"}'),
('HECA', 'CAI', 'Cairo Intl', 'Cairo', 'Egypt', 'H', 382, '["05L/23R", "05C/23C", "05R/23L"]', '{"TOWER": "118.1", "APP": "125.6"}', '{"sids": ["KRAM2A", "MENA3A"], "stars": ["CVO2A", "KAT2A"]}', '{"Gate to 05C": "Hotel"}'),
('HAAB', 'ADD', 'Bole', 'Addis Ababa', 'Ethiopia', 'H', 7625, '["07L/25R", "07R/25L"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["ADD1A", "ETH1A"], "stars": ["AB1A", "NI1A"]}', '{"Gate to 07L": "Alpha"}'),
('HKJK', 'NBO', 'Jomo Kenyatta', 'Nairobi', 'Kenya', 'H', 5327, '["06/24"]', '{"TOWER": "118.7", "APP": "119.7"}', '{"sids": ["KEN1A", "SAF1A"], "stars": ["WIL1A", "LIO1A"]}', '{"Gate to 06": "Alpha"}'),
('DNMM', 'LOS', 'Murtala Muhammed', 'Lagos', 'Nigeria', 'D', 135, '["18L/36R", "18R/36L"]', '{"TOWER": "118.1", "APP": "124.1"}', '{"sids": ["LAG1A", "NIG1A"], "stars": ["OIL1A", "DEL1A"]}', '{"Gate to 18L": "Alpha"}'),
('DGAA', 'ACC', 'Kotoka', 'Accra', 'Ghana', 'D', 205, '["03/21"]', '{"TOWER": "118.1", "APP": "119.7"}', '{"sids": ["ACC1A", "GHA1A"], "stars": ["COA1A", "GLD1A"]}', '{"Gate to 21": "Alpha"}'),
('GMMN', 'CMN', 'Mohammed V', 'Casablanca', 'Morocco', 'G', 656, '["17L/35R", "17R/35L"]', '{"TOWER": "118.1", "APP": "121.1"}', '{"sids": ["CAS1A", "MOR1A"], "stars": ["AT1A", "LZ1A"]}', '{"Gate to 35L": "Alpha"}'),
('DTTA', 'TUN', 'Carthage', 'Tunis', 'Tunisia', 'D', 22, '["01/19", "11/29"]', '{"TOWER": "118.1", "APP": "120.8"}', '{"sids": ["TUN1A", "CAR1A"], "stars": ["MED1A", "SAH1A"]}', '{"Gate to 19": "Alpha"}'),
('DAAG', 'ALG', 'Houari Boumediene', 'Algiers', 'Algeria', 'D', 82, '["05/23", "09/27"]', '{"TOWER": "118.7", "APP": "121.3"}', '{"sids": ["ALG1A", "DES1A"], "stars": ["SAN1A", "DUE1A"]}', '{"Gate to 05": "Alpha"}')

-- Use UPSERT to allow re-running without errors
ON CONFLICT (icao_code) DO UPDATE SET 
    runways = EXCLUDED.runways,
    frequencies = EXCLUDED.frequencies,
    procedures = EXCLUDED.procedures,
    taxi_routes = EXCLUDED.taxi_routes,
    elevation_ft = EXCLUDED.elevation_ft;
