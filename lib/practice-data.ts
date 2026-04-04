export type PracticeTopic = {
  slug: string;
  title: string;
  description: string;
  status: "available" | "coming-soon";
  href?: string;
  itemCount?: number;
};

export type PracticeCard = {
  prompt: string;
  answer: string;
};

export type PracticeDeckConfig = {
  slug: string;
  title: string;
  description: string;
  promptLabel: string;
  answerLabel: string;
  notes: string[];
  items: PracticeCard[];
  questionPrompt: (item: PracticeCard) => string;
  correctFeedback: (item: PracticeCard) => string;
  incorrectFeedback: (item: PracticeCard) => string;
};

function cleanCell(value: string) {
  return value.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
}

function cardsFromPairs(pairs: Array<[string, string]>): PracticeCard[] {
  return pairs.map(([prompt, answer]) => ({ prompt, answer }));
}

const WORLD_CAPITALS_RAW = `
Country	Capital City
Afghanistan	Kabul
Albania	Tirana (Tirane)
Algeria	Algiers
Andorra	Andorra la Vella
Angola	Luanda
Antigua and Barbuda	Saint John's
Argentina	Buenos Aires
Armenia	Yerevan
Australia	Canberra
Austria	Vienna
Azerbaijan	Baku
Bahamas	Nassau
Bahrain	Manama
Bangladesh	Dhaka
Barbados	Bridgetown
Belarus	Minsk
Belgium	Brussels
Belize	Belmopan
Benin	Porto Novo[1]
Bhutan	Thimphu
Bolivia	La Paz (administrative), Sucre (official)[2]
Bosnia and Herzegovina	Sarajevo
Botswana	Gaborone
Brazil	Brasilia
Brunei	Bandar Seri Begawan
Bulgaria	Sofia
Burkina Faso	Ouagadougou
Burundi	Gitega[3]
Cambodia	Phnom Penh
Cameroon	Yaounde
Canada	Ottawa
Cape Verde	Praia
Central African Republic	Bangui
Chad	N'Djamena
Chile	Santiago
China	Beijing
Colombia	Bogota
Comoros	Moroni
Congo, Democratic Republic of the	Kinshasa
Congo, Republic of the	Brazzaville
Costa Rica	San Jose
Côte d'Ivoire (Ivory Coast)	Yamoussoukro[4]
Croatia	Zagreb
Cuba	Havana
Cyprus	Nicosia
Czech Republic (Czechia)[5]	Prague
Denmark	Copenhagen
Djibouti	Djibouti
Dominica	Roseau
Dominican Republic	Santo Domingo
East Timor	Dili
Ecuador	Quito
Egypt	Cairo
El Salvador	San Salvador
England[6]	London
Equatorial Guinea	Ciudad de la Paz[7]
Eritrea	Asmara
Estonia	Tallinn
Eswatini (Swaziland)[8]	Mbabane[9]
Ethiopia	Addis Ababa
Federated States of Micronesia	Palikir
Fiji	Suva
Finland	Helsinki
France	Paris
Gabon	Libreville
Gambia	Banjul
Georgia	Tbilisi
Germany	Berlin
Ghana	Accra
Greece	Athens
Grenada	Saint George's
Guatemala	Guatemala City
Guinea	Conakry
Guinea-Bissau	Bissau
Guyana	Georgetown
Haiti	Port au Prince
Honduras	Tegucigalpa
Hungary	Budapest
Iceland	Reykjavik
India	New Delhi
Indonesia	Jakarta[10]
Iran	Tehran
Iraq	Baghdad
Ireland	Dublin
Israel	Jerusalem (very limited international recognition)[11]
Italy	Rome
Jamaica	Kingston
Japan	Tokyo
Jordan	Amman
Kazakhstan	Astana[12]
Kenya	Nairobi
Kiribati	Tarawa Atoll
Kosovo	Pristina
Kuwait	Kuwait City
Kyrgyzstan	Bishkek
Laos	Vientiane
Latvia	Riga
Lebanon	Beirut
Lesotho	Maseru
Liberia	Monrovia
Libya	Tripoli
Liechtenstein	Vaduz
Lithuania	Vilnius
Luxembourg	Luxembourg
Madagascar	Antananarivo
Malawi	Lilongwe
Malaysia	Kuala Lumpur[13]
Maldives	Male
Mali	Bamako
Malta	Valletta
Marshall Islands	Majuro
Mauritania	Nouakchott
Mauritius	Port Louis
Mexico	Mexico City
Moldova	Chisinau
Monaco	Monaco
Mongolia	Ulaanbaatar
Montenegro	Podgorica
Morocco	Rabat
Mozambique	Maputo
Myanmar (Burma)	Nay Pyi Taw[14]
Namibia	Windhoek
Nauru	No official capital
Nepal	Kathmandu
Netherlands	Amsterdam[15]
New Zealand	Wellington
Nicaragua	Managua
Niger	Niamey
Nigeria	Abuja
North Korea	Pyongyang
North Macedonia (Macedonia)[16]	Skopje
Northern Ireland[17]	Belfast
Norway	Oslo
Oman	Muscat
Pakistan	Islamabad
Palau	Ngerulmud
Palestine[18]	Jerusalem (very limited international recognition)[19]
Panama	Panama City
Papua New Guinea	Port Moresby
Paraguay	Asuncion
Peru	Lima
Philippines	Manila
Poland	Warsaw
Portugal	Lisbon
Qatar	Doha
Romania	Bucharest
Russia	Moscow
Rwanda	Kigali
Saint Kitts and Nevis	Basseterre
Saint Lucia	Castries
Saint Vincent and the Grenadines	Kingstown
Samoa	Apia
San Marino	San Marino
Sao Tome and Principe	Sao Tome
Saudi Arabia	Riyadh
Scotland[20]	Edinburgh
Senegal	Dakar
Serbia	Belgrade
Seychelles	Victoria
Sierra Leone	Freetown
Singapore	Singapore
Slovakia	Bratislava
Slovenia	Ljubljana
Solomon Islands	Honiara
Somalia	Mogadishu
South Africa	Pretoria, Bloemfontein, Cape Town[21]
South Korea	Seoul
South Sudan	Juba
Spain	Madrid
Sri Lanka	Sri Jayawardenapura Kotte[22]
Sudan	Khartoum
Suriname	Paramaribo
Sweden	Stockholm
Switzerland	Bern
Syria	Damascus
Taiwan[23]	Taipei
Tajikistan	Dushanbe
Tanzania	Dodoma[24]
Thailand	Bangkok
Togo	Lome
Tonga	Nuku'alofa
Trinidad and Tobago	Port of Spain
Tunisia	Tunis
Türkiye (Turkey)[25]	Ankara
Turkmenistan	Ashgabat
Tuvalu	Funafuti[26]
Uganda	Kampala
Ukraine	Kyiv or Kiev
United Arab Emirates	Abu Dhabi
United Kingdom	London
United States	Washington D.C.
Uruguay	Montevideo
Uzbekistan	Tashkent
Vanuatu	Port Vila
Vatican City	Vatican City
Venezuela	Caracas
Vietnam	Hanoi
Wales[27]	Cardiff
Yemen	Sana'a[28]
Zambia	Lusaka
Zimbabwe	Harare
`;

export const worldCapitals = WORLD_CAPITALS_RAW.trim()
  .split("\n")
  .slice(1)
  .map((row) => {
    const [country, capital] = row.split("\t");
    return {
      prompt: cleanCell(country),
      answer: cleanCell(capital),
    };
  });

export const usStateCapitals = cardsFromPairs([
  ["Alabama", "Montgomery"],
  ["Alaska", "Juneau"],
  ["Arizona", "Phoenix"],
  ["Arkansas", "Little Rock"],
  ["California", "Sacramento"],
  ["Colorado", "Denver"],
  ["Connecticut", "Hartford"],
  ["Delaware", "Dover"],
  ["Florida", "Tallahassee"],
  ["Georgia", "Atlanta"],
  ["Hawaii", "Honolulu"],
  ["Idaho", "Boise"],
  ["Illinois", "Springfield"],
  ["Indiana", "Indianapolis"],
  ["Iowa", "Des Moines"],
  ["Kansas", "Topeka"],
  ["Kentucky", "Frankfort"],
  ["Louisiana", "Baton Rouge"],
  ["Maine", "Augusta"],
  ["Maryland", "Annapolis"],
  ["Massachusetts", "Boston"],
  ["Michigan", "Lansing"],
  ["Minnesota", "Saint Paul"],
  ["Mississippi", "Jackson"],
  ["Missouri", "Jefferson City"],
  ["Montana", "Helena"],
  ["Nebraska", "Lincoln"],
  ["Nevada", "Carson City"],
  ["New Hampshire", "Concord"],
  ["New Jersey", "Trenton"],
  ["New Mexico", "Santa Fe"],
  ["New York", "Albany"],
  ["North Carolina", "Raleigh"],
  ["North Dakota", "Bismarck"],
  ["Ohio", "Columbus"],
  ["Oklahoma", "Oklahoma City"],
  ["Oregon", "Salem"],
  ["Pennsylvania", "Harrisburg"],
  ["Rhode Island", "Providence"],
  ["South Carolina", "Columbia"],
  ["South Dakota", "Pierre"],
  ["Tennessee", "Nashville"],
  ["Texas", "Austin"],
  ["Utah", "Salt Lake City"],
  ["Vermont", "Montpelier"],
  ["Virginia", "Richmond"],
  ["Washington", "Olympia"],
  ["West Virginia", "Charleston"],
  ["Wisconsin", "Madison"],
  ["Wyoming", "Cheyenne"],
]);

export const canadianProvincesAndTerritories = cardsFromPairs([
  ["Alberta", "Edmonton"],
  ["British Columbia", "Victoria"],
  ["Manitoba", "Winnipeg"],
  ["New Brunswick", "Fredericton"],
  ["Newfoundland and Labrador", "Saint John's"],
  ["Nova Scotia", "Halifax"],
  ["Ontario", "Toronto"],
  ["Prince Edward Island", "Charlottetown"],
  ["Quebec", "Quebec City"],
  ["Saskatchewan", "Regina"],
  ["Northwest Territories", "Yellowknife"],
  ["Nunavut", "Iqaluit"],
  ["Yukon", "Whitehorse"],
]);

export const americanPresidentsAndYears = cardsFromPairs([
  ["George Washington", "1789-1797"],
  ["John Adams", "1797-1801"],
  ["Thomas Jefferson", "1801-1809"],
  ["James Madison", "1809-1817"],
  ["James Monroe", "1817-1825"],
  ["John Quincy Adams", "1825-1829"],
  ["Andrew Jackson", "1829-1837"],
  ["Martin Van Buren", "1837-1841"],
  ["William Henry Harrison", "1841"],
  ["John Tyler", "1841-1845"],
  ["James K. Polk", "1845-1849"],
  ["Zachary Taylor", "1849-1850"],
  ["Millard Fillmore", "1850-1853"],
  ["Franklin Pierce", "1853-1857"],
  ["James Buchanan", "1857-1861"],
  ["Abraham Lincoln", "1861-1865"],
  ["Andrew Johnson", "1865-1869"],
  ["Ulysses S. Grant", "1869-1877"],
  ["Rutherford B. Hayes", "1877-1881"],
  ["James A. Garfield", "1881"],
  ["Chester A. Arthur", "1881-1885"],
  ["Grover Cleveland", "1885-1889"],
  ["Benjamin Harrison", "1889-1893"],
  ["Grover Cleveland (2nd term)", "1893-1897"],
  ["William McKinley", "1897-1901"],
  ["Theodore Roosevelt", "1901-1909"],
  ["William Howard Taft", "1909-1913"],
  ["Woodrow Wilson", "1913-1921"],
  ["Warren G. Harding", "1921-1923"],
  ["Calvin Coolidge", "1923-1929"],
  ["Herbert Hoover", "1929-1933"],
  ["Franklin D. Roosevelt", "1933-1945"],
  ["Harry S. Truman", "1945-1953"],
  ["Dwight D. Eisenhower", "1953-1961"],
  ["John F. Kennedy", "1961-1963"],
  ["Lyndon B. Johnson", "1963-1969"],
  ["Richard Nixon", "1969-1974"],
  ["Gerald Ford", "1974-1977"],
  ["Jimmy Carter", "1977-1981"],
  ["Ronald Reagan", "1981-1989"],
  ["George H. W. Bush", "1989-1993"],
  ["Bill Clinton", "1993-2001"],
  ["George W. Bush", "2001-2009"],
  ["Barack Obama", "2009-2017"],
  ["Donald Trump", "2017-2021"],
  ["Joe Biden", "2021-2025"],
  ["Donald Trump (2nd term)", "2025-present"],
]);

export const historicBattles = cardsFromPairs([
  ["Battle of Marathon", "490 BCE"],
  ["Battle of Cannae", "216 BCE"],
  ["Battle of Tours", "732"],
  ["Battle of Hastings", "1066"],
  ["Siege of Orleans", "1429"],
  ["Battle of Lepanto", "1571"],
  ["Battle of Yorktown", "1781"],
  ["Battle of Trafalgar", "1805"],
  ["Battle of Waterloo", "1815"],
  ["Battle of Antietam", "1862"],
  ["Battle of Gettysburg", "1863"],
  ["Battle of Little Bighorn", "1876"],
  ["Battle of Tsushima", "1905"],
  ["Gallipoli Campaign", "1915-1916"],
  ["Battle of the Somme", "1916"],
  ["Battle of Midway", "1942"],
  ["Battle of Kursk", "1943"],
  ["Battle of Normandy", "1944"],
  ["Battle of Dien Bien Phu", "1954"],
  ["Battle of Ia Drang", "1965"],
  ["Battle of 73 Easting", "1991"],
]);

export const practiceDecks: PracticeDeckConfig[] = [
  {
    slug: "world-capitals",
    title: "World Capitals",
    description: "Drill capitals through flashcards or multiple choice across the full list.",
    promptLabel: "Country",
    answerLabel: "Capital",
    notes: [
      "This deck preserves the wording from your supplied list, including disputed, administrative, and multi-capital entries.",
      "Use flashcards for broad repetition and multiple choice for faster recall checks.",
    ],
    items: worldCapitals,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "us-state-capitals",
    title: "U.S. State Capitals",
    description: "Practice all fifty state capitals with the same flashcard and quiz modes.",
    promptLabel: "State",
    answerLabel: "Capital",
    notes: [
      "This deck covers all 50 U.S. states and their capitals.",
      "Multiple choice pulls distractors from other state capitals in the same deck.",
    ],
    items: usStateCapitals,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "canadian-provinces",
    title: "Canadian Provinces and Territories",
    description: "Memorize provinces, territories, and their capitals across Canada.",
    promptLabel: "Province or Territory",
    answerLabel: "Capital",
    notes: [
      "The deck includes all 10 provinces and 3 territories.",
      "Use this alongside the state-capitals deck if you want a North America geography block.",
    ],
    items: canadianProvincesAndTerritories,
    questionPrompt: (item) => `What is the capital of ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.answer} is the capital of ${item.prompt}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} matches ${item.answer}.`,
  },
  {
    slug: "american-presidents",
    title: "American Presidents and Years",
    description: "Practice presidents against the years they served in office.",
    promptLabel: "President",
    answerLabel: "Years in Office",
    notes: [
      "Grover Cleveland appears twice because his terms were non-consecutive.",
      "This deck reflects the current presidency as of March 20, 2026, with Donald Trump listed as serving from 2025-present.",
    ],
    items: americanPresidentsAndYears,
    questionPrompt: (item) => `What were the presidential term years for ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.prompt} served from ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt}'s presidential years were ${item.answer}.`,
  },
  {
    slug: "historic-battles",
    title: "Historic Battles",
    description: "Review major battles and the years or year ranges associated with them.",
    promptLabel: "Battle",
    answerLabel: "Year",
    notes: [
      "This is a compact survey deck rather than an exhaustive military-history timeline.",
      "Some entries use year ranges for campaigns or battles that spanned more than one calendar year.",
    ],
    items: historicBattles,
    questionPrompt: (item) => `When was ${item.prompt}?`,
    correctFeedback: (item) => `Correct. ${item.prompt} was fought in ${item.answer}.`,
    incorrectFeedback: (item) => `Not this one. ${item.prompt} is associated with ${item.answer}.`,
  },
];

export const practiceTopics: PracticeTopic[] = practiceDecks.map((deck) => ({
  slug: deck.slug,
  title: deck.title,
  description: deck.description,
  status: "available",
  href: `/practice/${deck.slug}`,
  itemCount: deck.items.length,
}));

export function getPracticeDeck(slug: string) {
  return practiceDecks.find((deck) => deck.slug === slug);
}
