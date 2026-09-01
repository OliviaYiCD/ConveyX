#!/usr/bin/env node
/**
 * Rebuild providers-all.csv from the products catalog with type, state,
 * description, and public contact details (councils, utilities, registries).
 */
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const productsPath = resolve(
  process.argv[2] ?? join(process.env.HOME ?? "", "Downloads/products-all.csv")
);
const outputDir = resolve(process.argv[3] ?? join(__dirname, "../data/import"));

const PRODUCT_TYPE_MAP = {
  "body corporate": "BodyCorp",
  "council certificate": "LGA",
  "lga certificate": "LGA",
  "utility certificate": "Utility",
  "state government certificate": "State_government",
  "other providers": "Other",
};

/** Official public contacts — keyed by normalised provider name. */
const CONTACTS = {
  "sydney water": {
    type: "Utility",
    website: "https://www.sydneywater.com.au",
    email: "customerservice@sydneywater.com.au",
    contact_number: "13 20 92",
    description: "Sydney Water — water and wastewater utility for Greater Sydney.",
  },
  "hunter water": {
    type: "Utility",
    website: "https://www.hunterwater.com.au",
    email: "enquiries@hunterwater.com.au",
    contact_number: "1300 657 657",
    description: "Hunter Water — water and wastewater utility for the Hunter region, NSW.",
  },
  "yarra valley water": {
    type: "Utility",
    website: "https://www.yvw.com.au",
    email: "enquiries@yvw.com.au",
    contact_number: "1300 304 688",
    description: "Yarra Valley Water — water retailer serving Melbourne’s north and east.",
  },
  "south east water": {
    type: "Utility",
    website: "https://www.southeastwater.com.au",
    email: "support@sew.com.au",
    contact_number: "13 18 51",
    description: "South East Water — water retailer serving south-east Melbourne.",
  },
  "greater western water": {
    type: "Utility",
    website: "https://www.gww.com.au",
    email: "info@gww.com.au",
    contact_number: "13 44 99",
    description: "Greater Western Water — water retailer for Melbourne’s west and north-west (formerly City West Water and Western Water).",
  },
  "melbourne water": {
    type: "Utility",
    website: "https://www.melbournewater.com.au",
    email: "enquiry@melbournewater.com.au",
    contact_number: "131 722",
    description: "Melbourne Water — bulk water, sewerage and waterways manager for Greater Melbourne.",
  },
  "barwon region water": {
    type: "Utility",
    website: "https://www.barwonwater.vic.gov.au",
    email: "info@barwonwater.vic.gov.au",
    contact_number: "1300 656 007",
    description: "Barwon Water — regional water corporation for Geelong and the Bellarine.",
  },
  "central highlands water": {
    type: "Utility",
    website: "https://www.chw.net.au",
    email: "customer@chw.net.au",
    contact_number: "1800 061 614",
    description: "Central Highlands Water — regional water corporation for Ballarat and central Victoria.",
  },
  "coliban region water": {
    type: "Utility",
    website: "https://www.coliban.com.au",
    email: "coliban@coliban.com.au",
    contact_number: "1300 363 200",
    description: "Coliban Water — regional water corporation for Bendigo and north-central Victoria.",
  },
  "gippsland region water": {
    type: "Utility",
    website: "https://www.gippswater.com.au",
    email: "contactus@gippswater.com.au",
    contact_number: "1800 066 401",
    description: "Gippsland Water — regional water corporation for central Gippsland.",
  },
  "goulburn valley region water": {
    type: "Utility",
    website: "https://www.gvwater.vic.gov.au",
    email: "contactus@gvwater.vic.gov.au",
    contact_number: "1800 454 500",
    description: "Goulburn Valley Water — regional water corporation for Shepparton and the Goulburn Valley.",
  },
  "north east region water": {
    type: "Utility",
    website: "https://www.newater.com.au",
    email: "info@newater.com.au",
    contact_number: "1300 361 633",
    description: "North East Water — regional water corporation for north-east Victoria.",
  },
  "wannon region water": {
    type: "Utility",
    website: "https://www.wannonwater.com.au",
    email: "info@wannonwater.com.au",
    contact_number: "1300 926 666",
    description: "Wannon Water — regional water corporation for south-west Victoria.",
  },
  "westernport region water": {
    type: "Utility",
    website: "https://www.westernportwater.com.au",
    email: "westport@westernportwater.com.au",
    contact_number: "1300 720 711",
    description: "Westernport Water — regional water corporation for Phillip Island and Bass Coast.",
  },
  "south gippsland region water": {
    type: "Utility",
    website: "https://www.sgwater.com.au",
    email: "sgwater@sgwater.com.au",
    contact_number: "1300 851 636",
    description: "South Gippsland Water — regional water corporation for south Gippsland.",
  },
  "east gippsland region water": {
    type: "Utility",
    website: "https://www.egwater.vic.gov.au",
    email: "feedback@egwater.vic.gov.au",
    contact_number: "1800 671 841",
    description: "East Gippsland Water — regional water corporation for East Gippsland.",
  },
  "grampians wimmera mallee water": {
    type: "Utility",
    website: "https://www.gwmwater.org.au",
    email: "info@gwmwater.org.au",
    contact_number: "1300 659 961",
    description: "GWMWater — regional water corporation for the Grampians, Wimmera and Mallee.",
  },
  "goulburn murray rural water": {
    type: "Utility",
    website: "https://www.g-mwater.com.au",
    email: "reception@gmwater.com.au",
    contact_number: "1800 013 357",
    description: "Goulburn-Murray Water — rural water corporation managing irrigation in northern Victoria.",
  },
  "lower murray urban & rural water authority (rural)": {
    type: "Utility",
    website: "https://www.lmw.vic.gov.au",
    email: "info@lmw.vic.gov.au",
    contact_number: "03 5051 3400",
    description: "Lower Murray Water (rural) — irrigation and rural water services in north-west Victoria.",
  },
  "lower murray urban & rural water authority (urban)": {
    type: "Utility",
    website: "https://www.lmw.vic.gov.au",
    email: "info@lmw.vic.gov.au",
    contact_number: "03 5051 3400",
    description: "Lower Murray Water (urban) — urban water and wastewater for Mildura and the Murray Valley.",
  },
  "southern rural water": {
    type: "Utility",
    website: "https://www.srw.com.au",
    email: "srw@srw.com.au",
    contact_number: "1300 139 510",
    description: "Southern Rural Water — rural water corporation for southern Victoria.",
  },
  "unitywater": {
    type: "Utility",
    website: "https://www.unitywater.com",
    email: "customerservice@unitywater.com",
    contact_number: "1300 0 UNITY (1300 086 489)",
    description: "Unitywater — water and sewerage provider for Moreton Bay, Sunshine Coast and Noosa.",
  },
  "queensland urban utilities": {
    type: "Utility",
    website: "https://www.urbanutilities.com.au",
    email: "customerservice@urbanutilities.com.au",
    contact_number: "13 26 57",
    description: "Urban Utilities — water and sewerage provider for Brisbane and south-east Queensland.",
  },
  "wide bay water": {
    type: "Utility",
    website: "https://www.frasercoast.qld.gov.au",
    email: "enquiry@frasercoast.qld.gov.au",
    contact_number: "1300 79 49 29",
    description: "Wide Bay Water — water services for the Fraser Coast region, Queensland.",
  },
  "energex": {
    type: "Utility",
    website: "https://www.energex.com.au",
    email: "customercare@energex.com.au",
    contact_number: "13 12 53",
    description: "Energex — electricity distribution network for south-east Queensland.",
  },
  "ergon energy": {
    type: "Utility",
    website: "https://www.ergon.com.au",
    email: "customercare@ergon.com.au",
    contact_number: "13 10 46",
    description: "Ergon Energy — electricity distribution network for regional Queensland.",
  },
  "powerlink": {
    type: "Utility",
    website: "https://www.powerlink.com.au",
    email: "pqenquiries@powerlink.com.au",
    contact_number: "1800 635 369",
    description: "Powerlink Queensland — high-voltage electricity transmission network.",
  },
  "vic landata": {
    type: "LandInfo",
    website: "https://www.land.vic.gov.au",
    email: "landata.online@servictoria.com.au",
    contact_number: "03 9102 0401",
    description: "LANDATA — Victorian land titles, property and survey information (Land Use Victoria).",
  },
  "revenue nsw": {
    type: "State_government",
    website: "https://www.revenue.nsw.gov.au",
    email: "duties.online@revenue.nsw.gov.au",
    contact_number: "1300 139 814",
    description: "Revenue NSW — land tax, stamp duty and state revenue certificates.",
  },
  "sro": {
    type: "State_government",
    website: "https://www.sro.vic.gov.au",
    email: "sro@sro.vic.gov.au",
    contact_number: "13 21 61",
    description: "State Revenue Office Victoria — land tax and duties certificates.",
  },
  "state revenue office": {
    type: "State_government",
    website: "https://www.sro.vic.gov.au",
    email: "sro@sro.vic.gov.au",
    contact_number: "13 21 61",
    description: "State Revenue Office Victoria — land tax and duties certificates.",
  },
  "office of state revenue": {
    type: "State_government",
    website: "https://qro.qld.gov.au",
    email: "osr.duties@treasury.qld.gov.au",
    contact_number: "1300 300 734",
    description: "Queensland Revenue Office — transfer duty, land tax and state revenue.",
  },
  "vicroads": {
    type: "State_government",
    website: "https://www.vicroads.vic.gov.au",
    email: "info@roads.vic.gov.au",
    contact_number: "13 11 71",
    description: "VicRoads (Department of Transport and Planning) — roads and property access information.",
  },
  "heritage victoria": {
    type: "State_government",
    website: "https://www.heritage.vic.gov.au",
    email: "heritage.victoria@dtp.vic.gov.au",
    contact_number: "03 7020 0000",
    description: "Heritage Victoria — Victorian Heritage Register and heritage certificates.",
  },
  "environmental protection authority": {
    type: "State_government",
    website: "https://www.epa.vic.gov.au",
    email: "contact@epa.vic.gov.au",
    contact_number: "1300 372 842",
    description: "EPA Victoria — environmental protection certificates and site information.",
  },
  "dept of environment land water & planning": {
    type: "State_government",
    website: "https://www.deeca.vic.gov.au",
    email: "customer.service@deeca.vic.gov.au",
    contact_number: "136 186",
    description: "Department of Energy, Environment and Climate Action (formerly DELWP) — planning, land and water information.",
  },
  "department of natural resources and mines": {
    type: "State_government",
    website: "https://www.resources.qld.gov.au",
    email: "info@resources.qld.gov.au",
    description: "Queensland Department of Resources — mining, land and titles information.",
  },
  "department of transport and main roads": {
    type: "State_government",
    website: "https://www.tmr.qld.gov.au",
    email: "info@tmr.qld.gov.au",
    contact_number: "13 23 80",
    description: "Queensland Department of Transport and Main Roads — roads and property access information.",
  },
  "queensland building and construction commission": {
    type: "State_government",
    website: "https://www.qbcc.qld.gov.au",
    email: "info@qbcc.qld.gov.au",
    contact_number: "139 333",
    description: "QBCC — building licences, insurance and construction certificates.",
  },
  "queensland civil administrative tribunal": {
    type: "State_government",
    website: "https://www.qcat.qld.gov.au",
    email: "enquiries@qcat.qld.gov.au",
    contact_number: "1300 753 228",
    description: "QCAT — civil and administrative tribunal searches and orders.",
  },
  "queensland fire and emergency services": {
    type: "State_government",
    website: "https://www.qfes.qld.gov.au",
    email: "info@qfes.qld.gov.au",
    contact_number: "13 QGOV (13 74 68)",
    description: "Queensland Fire and Emergency Services — fire safety and emergency information.",
  },
  "workplace health and safety queensland": {
    type: "State_government",
    website: "https://www.worksafe.qld.gov.au",
    email: "whsq.policy@oir.qld.gov.au",
    contact_number: "1300 362 128",
    description: "Workplace Health and Safety Queensland — workplace safety certificates and information.",
  },
  "aboriginal affairs victoria": {
    type: "State_government",
    website: "https://www.firstpeoplesrelations.vic.gov.au",
    description: "First Peoples - State Relations (formerly Aboriginal Affairs Victoria) — cultural heritage information.",
  },
  "aboriginal site register": {
    type: "State_government",
    website: "https://www.environment.nsw.gov.au/topics/aboriginal-cultural-heritage",
    description: "NSW Aboriginal Heritage Information Management System (AHIMS) site register.",
  },
  "nsw land registry services": {
    type: "LandInfo",
    website: "https://www.nswlrs.com.au",
    email: "customerservice@nswlrs.com.au",
    contact_number: "1300 396 601",
    description: "NSW Land Registry Services — official land titles registry for New South Wales.",
  },
  "land and property information city council": {
    type: "LandInfo",
    website: "https://www.nswlrs.com.au",
    email: "customerservice@nswlrs.com.au",
    contact_number: "1300 396 601",
    description: "NSW Land Registry Services (formerly Land and Property Information) — titles and property information.",
  },
};

/** Official council website overrides where the slug is not {name}.{state}.gov.au */
const COUNCIL_SITES = {
  "sydney city council": { website: "https://www.cityofsydney.nsw.gov.au", email: "customercare@cityofsydney.nsw.gov.au", contact_number: "02 9265 9333" },
  "city of parramatta city council": { website: "https://www.cityofparramatta.nsw.gov.au", email: "council@cityofparramatta.nsw.gov.au", contact_number: "1300 617 058" },
  "brisbane city council": { website: "https://www.brisbane.qld.gov.au", email: "info@brisbane.qld.gov.au", contact_number: "07 3403 8888" },
  "melbourne city council": { website: "https://www.melbourne.vic.gov.au", email: "enquiries@melbourne.vic.gov.au", contact_number: "03 9658 9658" },
  "gold coast city council": { website: "https://www.goldcoast.qld.gov.au", email: "mail@goldcoast.qld.gov.au", contact_number: "1300 465 326" },
  "greater geelong city council": { website: "https://www.geelongaustralia.com.au", email: "contactus@geelongcity.vic.gov.au", contact_number: "03 5272 5272" },
  "ku-ring-gai city council": { website: "https://www.krg.nsw.gov.au", email: "kmc@krg.nsw.gov.au", contact_number: "02 9424 0000" },
  "the hills shire council": { website: "https://www.thehills.nsw.gov.au", email: "council@thehills.nsw.gov.au", contact_number: "02 9843 0555" },
  "inner west city council": { website: "https://www.innerwest.nsw.gov.au", email: "council@innerwest.nsw.gov.au", contact_number: "02 9392 5000" },
  "northern beaches city council": { website: "https://www.northernbeaches.nsw.gov.au", email: "council@northernbeaches.nsw.gov.au", contact_number: "1300 434 434" },
  "canterbury-bankstown city council": { website: "https://www.cbcity.nsw.gov.au", email: "council@cbcity.nsw.gov.au", contact_number: "02 9707 9000" },
  "georges river city council": { website: "https://www.georgesriver.nsw.gov.au", email: "mail@georgesriver.nsw.gov.au", contact_number: "02 9330 6400" },
  "hunter's hill city council": { website: "https://www.huntershill.nsw.gov.au", email: "council@huntershill.nsw.gov.au", contact_number: "02 9879 9400" },
  "merri-bek city council": { website: "https://www.merri-bek.vic.gov.au", email: "info@merri-bek.vic.gov.au", contact_number: "03 9240 1111" },
  "moreton bay regional council": { website: "https://www.moretonbay.qld.gov.au", email: "mbrc@moretonbay.qld.gov.au", contact_number: "07 3205 0555" },
  "sunshine coast regional council": { website: "https://www.sunshinecoast.qld.gov.au", email: "mail@sunshinecoast.qld.gov.au", contact_number: "07 5475 7272" },
  "noosa shire council": { website: "https://www.noosa.qld.gov.au", email: "mail@noosa.qld.gov.au", contact_number: "07 5329 6500" },
  "ipswich city council": { website: "https://www.ipswich.qld.gov.au", email: "council@ipswich.qld.gov.au", contact_number: "07 3810 6666" },
  "logan city council": { website: "https://www.logan.qld.gov.au", email: "council@logan.qld.gov.au", contact_number: "07 3412 3412" },
  "toowoomba regional council": { website: "https://www.tr.qld.gov.au", email: "info@tr.qld.gov.au", contact_number: "131 872" },
  "townsville city council": { website: "https://www.townsville.qld.gov.au", email: "enquiries@townsville.qld.gov.au", contact_number: "13 48 10" },
  "cairns regional council": { website: "https://www.cairns.qld.gov.au", email: "council@cairns.qld.gov.au", contact_number: "1300 692 247" },
  "albury city council": { website: "https://www.alburycity.nsw.gov.au", email: "info@alburycity.nsw.gov.au", contact_number: "02 6023 8111" },
  "newcastle city council": { website: "https://www.newcastle.nsw.gov.au", email: "mail@ncc.nsw.gov.au", contact_number: "02 4974 2000" },
  "wollongong city council": { website: "https://www.wollongong.nsw.gov.au", email: "council@wollongong.nsw.gov.au", contact_number: "02 4227 7111" },
  "blacktown city council": { website: "https://www.blacktown.nsw.gov.au", email: "council@blacktown.nsw.gov.au", contact_number: "02 9839 6000" },
  "penrith city council": { website: "https://www.penrithcity.nsw.gov.au", email: "council@penrithcity.nsw.gov.au", contact_number: "02 4732 7777" },
  "sutherland shire council": { website: "https://www.sutherlandshire.nsw.gov.au", email: "ssc@ssc.nsw.gov.au", contact_number: "02 9710 0333" },
  "randwick city council": { website: "https://www.randwick.nsw.gov.au", email: "council@randwick.nsw.gov.au", contact_number: "1300 722 542" },
  "woollahra city council": { website: "https://www.woollahra.nsw.gov.au", email: "records@woollahra.nsw.gov.au", contact_number: "02 9391 7000" },
  "waverley city council": { website: "https://www.waverley.nsw.gov.au", email: "info@waverley.nsw.gov.au", contact_number: "02 9083 8000" },
  "north sydney city council": { website: "https://www.northsydney.nsw.gov.au", email: "council@northsydney.nsw.gov.au", contact_number: "02 9936 8100" },
  "willoughby city council": { website: "https://www.willoughby.nsw.gov.au", email: "email@willoughby.nsw.gov.au", contact_number: "02 9777 1000" },
  "lane cove city council": { website: "https://www.lanecove.nsw.gov.au", email: "lccouncil@lanecove.nsw.gov.au", contact_number: "02 9911 3555" },
  "mosman city council": { website: "https://www.mosman.nsw.gov.au", email: "council@mosman.nsw.gov.au", contact_number: "02 9978 4000" },
  "hornsby city council": { website: "https://www.hornsby.nsw.gov.au", email: "hsc@hornsby.nsw.gov.au", contact_number: "02 9847 6666" },
  "ryde city council": { website: "https://www.ryde.nsw.gov.au", email: "cityofryde@ryde.nsw.gov.au", contact_number: "02 9952 8222" },
  "canada bay city council": { website: "https://www.canadabay.nsw.gov.au", email: "council@canadabay.nsw.gov.au", contact_number: "02 9911 6555" },
  "strathfield city council": { website: "https://www.strathfield.nsw.gov.au", email: "council@strathfield.nsw.gov.au", contact_number: "02 9748 9999" },
  "burwood city council": { website: "https://www.burwood.nsw.gov.au", email: "council@burwood.nsw.gov.au", contact_number: "02 9911 9911" },
  "cumberland city council": { website: "https://www.cumberland.nsw.gov.au", email: "council@cumberland.nsw.gov.au", contact_number: "02 8757 9000" },
  "fairfield city council": { website: "https://www.fairfieldcity.nsw.gov.au", email: "mail@fairfieldcity.nsw.gov.au", contact_number: "02 9725 0222" },
  "liverpool city council": { website: "https://www.liverpool.nsw.gov.au", email: "lcc@liverpool.nsw.gov.au", contact_number: "1300 36 2170" },
  "camden city council": { website: "https://www.camden.nsw.gov.au", email: "mail@camden.nsw.gov.au", contact_number: "02 4654 7777" },
  "campbelltown city council": { website: "https://www.campbelltown.nsw.gov.au", email: "council@campbelltown.nsw.gov.au", contact_number: "02 4645 4000" },
  "hawkesbury city council": { website: "https://www.hawkesbury.nsw.gov.au", email: "council@hawkesbury.nsw.gov.au", contact_number: "02 4560 4444" },
  "blue mountains city council": { website: "https://www.bmcc.nsw.gov.au", email: "council@bmcc.nsw.gov.au", contact_number: "02 4780 5000" },
  "wollondilly city council": { website: "https://www.wollondilly.nsw.gov.au", email: "council@wollondilly.nsw.gov.au", contact_number: "02 4677 1100" },
  "central coast city council": { website: "https://www.centralcoast.nsw.gov.au", email: "ask@centralcoast.nsw.gov.au", contact_number: "02 4306 7900" },
  "lake macquarie city council": { website: "https://www.lakemac.com.au", email: "council@lakemac.nsw.gov.au", contact_number: "02 4921 0333" },
  "maitland city council": { website: "https://www.maitland.nsw.gov.au", email: "info@maitland.nsw.gov.au", contact_number: "02 4934 9700" },
  "cessnock city council": { website: "https://www.cessnock.nsw.gov.au", email: "council@cessnock.nsw.gov.au", contact_number: "02 4993 4100" },
  "port stephens city council": { website: "https://www.portstephens.nsw.gov.au", email: "council@portstephens.nsw.gov.au", contact_number: "02 4988 0255" },
  "mid-coast city council": { website: "https://www.midcoast.nsw.gov.au", email: "council@midcoast.nsw.gov.au", contact_number: "02 7955 7777" },
  "port macquarie-hastings city council": { website: "https://www.pmhc.nsw.gov.au", email: "council@pmhc.nsw.gov.au", contact_number: "02 6581 8111" },
  "coffs harbour city council": { website: "https://www.chcc.nsw.gov.au", email: "coffs.council@chcc.nsw.gov.au", contact_number: "02 6648 4000" },
  "ballina city council": { website: "https://www.ballina.nsw.gov.au", email: "council@ballina.nsw.gov.au", contact_number: "02 6686 4444" },
  "byron city council": { website: "https://www.byron.nsw.gov.au", email: "council@byron.nsw.gov.au", contact_number: "02 6626 7000" },
  "tweed city council": { website: "https://www.tweed.nsw.gov.au", email: "tsc@tweed.nsw.gov.au", contact_number: "02 6670 2400" },
  "lismore city council": { website: "https://www.lismore.nsw.gov.au", email: "council@lismore.nsw.gov.au", contact_number: "02 6625 0500" },
  "shoalhaven city council": { website: "https://www.shoalhaven.nsw.gov.au", email: "council@shoalhaven.nsw.gov.au", contact_number: "1300 293 111" },
  "kiama city council": { website: "https://www.kiama.nsw.gov.au", email: "council@kiama.nsw.gov.au", contact_number: "02 4232 0444" },
  "shellharbour city council": { website: "https://www.shellharbour.nsw.gov.au", email: "council@shellharbour.nsw.gov.au", contact_number: "02 4221 6111" },
  "wingecarribee city council": { website: "https://www.wsc.nsw.gov.au", email: "mail@wsc.nsw.gov.au", contact_number: "02 4868 0888" },
  "gowburn mulwaree city council": { website: "https://www.goulburn.nsw.gov.au", email: "council@goulburn.nsw.gov.au", contact_number: "02 4823 4444" },
  "goulburn mulwaree city council": { website: "https://www.goulburn.nsw.gov.au", email: "council@goulburn.nsw.gov.au", contact_number: "02 4823 4444" },
  "wagga wagga city council": { website: "https://www.wagga.nsw.gov.au", email: "council@wagga.nsw.gov.au", contact_number: "1300 292 442" },
  "orange city council": { website: "https://www.orange.nsw.gov.au", email: "council@orange.nsw.gov.au", contact_number: "02 6393 8000" },
  "bathurst regional council": { website: "https://www.bathurst.nsw.gov.au", email: "council@bathurst.nsw.gov.au", contact_number: "02 6333 6111" },
  "dubbo regional council": { website: "https://www.dubbo.nsw.gov.au", email: "council@dubbo.nsw.gov.au", contact_number: "02 6801 4000" },
  "tamworth regional council": { website: "https://www.tamworth.nsw.gov.au", email: "trc@tamworth.nsw.gov.au", contact_number: "02 6767 5555" },
  "armidale regional council (armidale dumaresq council) city council": { website: "https://www.armidaleregional.nsw.gov.au", email: "council@armidale.nsw.gov.au", contact_number: "1300 136 833" },
  "queanbeyan-palerang regional council": { website: "https://www.qprc.nsw.gov.au", email: "council@qprc.nsw.gov.au", contact_number: "1300 735 025" },
  "alpine shire council": { website: "https://www.alpineshire.vic.gov.au", email: "info@alpineshire.vic.gov.au", contact_number: "03 5755 0555" },
  "ballarat city council": { website: "https://www.ballarat.vic.gov.au", email: "ballcity@ballarat.vic.gov.au", contact_number: "03 5320 5500" },
  "boroondara city council": { website: "https://www.boroondara.vic.gov.au", email: "boroondara@boroondara.vic.gov.au", contact_number: "03 9278 4444" },
  "casey city council": { website: "https://www.casey.vic.gov.au", email: "caseycc@casey.vic.gov.au", contact_number: "03 9705 5200" },
  "darebin city council": { website: "https://www.darebin.vic.gov.au", email: "mailbox@darebin.vic.gov.au", contact_number: "03 8470 8888" },
  "frankston city council": { website: "https://www.frankston.vic.gov.au", email: "info@frankston.vic.gov.au", contact_number: "1300 322 322" },
  "greater bendigo city council": { website: "https://www.bendigo.vic.gov.au", email: "requests@bendigo.vic.gov.au", contact_number: "03 5434 6000" },
  "greater dandenong city council": { website: "https://www.greaterdandenong.vic.gov.au", email: "council@cgd.vic.gov.au", contact_number: "8571 1000" },
  "hume city council": { website: "https://www.hume.vic.gov.au", email: "contactus@hume.vic.gov.au", contact_number: "03 9205 2200" },
  "kingston city council": { website: "https://www.kingston.vic.gov.au", email: "info@kingston.vic.gov.au", contact_number: "1300 653 356" },
  "knox city council": { website: "https://www.knox.vic.gov.au", email: "knoxcc@knox.vic.gov.au", contact_number: "03 9298 8000" },
  "manningham city council": { website: "https://www.manningham.vic.gov.au", email: "manningham@manningham.vic.gov.au", contact_number: "03 9840 9333" },
  "monash city council": { website: "https://www.monash.vic.gov.au", email: "mail@monash.vic.gov.au", contact_number: "03 9518 3555" },
  "moonee valley city council": { website: "https://www.mvcc.vic.gov.au", email: "council@mvcc.vic.gov.au", contact_number: "03 9243 8888" },
  "mornington peninsula shire council": { website: "https://www.mornpen.vic.gov.au", email: "customerservice@mornpen.vic.gov.au", contact_number: "1300 850 600" },
  "port phillip city council": { website: "https://www.portphillip.vic.gov.au", email: "help@portphillip.vic.gov.au", contact_number: "03 9209 6777" },
  "stonnington city council": { website: "https://www.stonnington.vic.gov.au", email: "council@stonnington.vic.gov.au", contact_number: "03 8290 1333" },
  "whitehorse city council": { website: "https://www.whitehorse.vic.gov.au", email: "customer.service@whitehorse.vic.gov.au", contact_number: "03 9262 6333" },
  "whittlesea city council": { website: "https://www.whittlesea.vic.gov.au", email: "info@whittlesea.vic.gov.au", contact_number: "03 9217 2170" },
  "wyndham city council": { website: "https://www.wyndham.vic.gov.au", email: "mail@wyndham.vic.gov.au", contact_number: "03 9742 0777" },
  "yarra city council": { website: "https://www.yarracity.vic.gov.au", email: "info@yarracity.vic.gov.au", contact_number: "03 9205 5555" },
  "yarra ranges shire council": { website: "https://www.yarraranges.vic.gov.au", email: "mail@yarraranges.vic.gov.au", contact_number: "1300 368 333" },
  "bayside city council": { website: "https://www.bayside.vic.gov.au", email: "enquiries@bayside.vic.gov.au", contact_number: "03 9599 4444" },
  "brimbank city council": { website: "https://www.brimbank.vic.gov.au", email: "info@brimbank.vic.gov.au", contact_number: "03 9249 4000" },
  "hobsons bay city council": { website: "https://www.hobsonsbay.vic.gov.au", email: "customerservice@hobsonsbay.vic.gov.au", contact_number: "1300 179 944" },
  "maribyrnong city council": { website: "https://www.maribyrnong.vic.gov.au", email: "email@maribyrnong.vic.gov.au", contact_number: "03 9688 0200" },
  "melton city council": { website: "https://www.melton.vic.gov.au", email: "customer.service@melton.vic.gov.au", contact_number: "03 9747 7200" },
  "nillumbik shire council": { website: "https://www.nillumbik.vic.gov.au", email: "nillumbik@nillumbik.vic.gov.au", contact_number: "03 9433 3111" },
  "glen eira city council": { website: "https://www.gleneira.vic.gov.au", email: "mail@gleneira.vic.gov.au", contact_number: "03 9524 3333" },
};

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

function csvEscape(value) {
  const s = value ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function dominant(counts) {
  let best = "";
  let max = 0;
  for (const [k, n] of Object.entries(counts)) {
    if (!k) continue;
    if (n > max) {
      max = n;
      best = k;
    }
  }
  return best;
}

function mapProductType(raw) {
  return PRODUCT_TYPE_MAP[(raw ?? "").trim().toLowerCase()] ?? "Other";
}

function inferTypeFromName(name, productType) {
  const n = name.toLowerCase();
  if (/\bowners corporation\b|\bbody corp|\bstrata|\boc pty/i.test(n)) return "BodyCorp";
  if (/\bcouncil\b|\bshire\b|\bcity of\b|\bborough of\b/i.test(n) && !/water city council/i.test(n)) return "LGA";
  if (/\bwater\b|\butility\b|\benergex|\bergon|\bpowerlink|\btelco/i.test(n) && !/council/i.test(n)) return "Utility";
  if (/\blandata\b|\bland registry\b|\bland and property/i.test(n)) return "LandInfo";
  if (/\brevenue\b|\bsro\b|\bdepartment of\b|\bdept of\b|\bepa\b|\bheritage\b|\bvicroads|\bqcat|\bqbcc/i.test(n))
    return "State_government";
  return productType;
}

function councilSlug(name) {
  return name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\s+city council$/i, "")
    .replace(/\s+shire council$/i, "")
    .replace(/\s+regional council$/i, "")
    .replace(/\s+rural city council$/i, "")
    .replace(/^city of\s+/i, "")
    .replace(/^borough of\s+/i, "")
    .replace(/\s+council$/i, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^the/, "");
}

function lgaWebsite(name, state) {
  const key = name.toLowerCase();
  if (COUNCIL_SITES[key]) return COUNCIL_SITES[key];
  const slug = councilSlug(name);
  if (!slug || !state) return {};
  const host = `${slug}.${state.toLowerCase()}.gov.au`;
  return {
    website: `https://www.${host}`,
    email: `info@${host}`,
  };
}

function typeDescription(name, type, state, productDesc) {
  if (productDesc) {
    const first = productDesc.split(/(?<=\.)\s/)[0];
    if (first && first.length > 40) return first.slice(0, 280);
  }
  const loc = state ? ` in ${state}` : "";
  switch (type) {
    case "LGA":
      return `${name} is the local government authority${loc}. It issues council land information certificates covering rates, charges, notices and orders.`;
    case "Utility":
      return `${name} is a water or utility provider${loc} supplying property water, sewer and meter information for settlements.`;
    case "BodyCorp":
      return `${name} is an owners corporation / body corporate manager${loc} providing strata records and certificates.`;
    case "LandInfo":
      return `${name} is a state land titles and registry service${loc}.`;
    case "State_government":
      return `${name} is a state government agency${loc} providing statutory property certificates.`;
    default:
      return `${name} provides property search and certificate services${loc}.`;
  }
}

function lookup(name) {
  const key = name.toLowerCase().trim();
  if (CONTACTS[key]) return CONTACTS[key];
  for (const [k, v] of Object.entries(CONTACTS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const rl = createInterface({ input: createReadStream(productsPath, { encoding: "utf8" }) });
  let headers = null;
  const byProvider = new Map();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (!headers) {
      headers = cells.map((h) => h.toLowerCase());
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    const name = row.provider_name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byProvider.has(key)) {
      byProvider.set(key, {
        name,
        typeCounts: {},
        states: {},
        councils: new Set(),
        descriptions: [],
      });
    }
    const entry = byProvider.get(key);
    const pType = mapProductType(row.type);
    entry.typeCounts[pType] = (entry.typeCounts[pType] ?? 0) + 1;
    if (row.state?.trim()) entry.states[row.state.trim()] = (entry.states[row.state.trim()] ?? 0) + 1;
    if (row.council?.trim() && row.council !== "ALL") entry.councils.add(row.council.trim());
    if (row.description?.trim() && entry.descriptions.length < 2) {
      entry.descriptions.push(row.description.trim());
    }
  }

  const providers = [...byProvider.values()]
    .map((entry) => {
      const productType = dominant(entry.typeCounts) || "Other";
      const type = inferTypeFromName(entry.name, productType);
      const state = dominant(entry.states) || "";
      const known = lookup(entry.name) ?? {};
      const lga = type === "LGA" ? lgaWebsite(entry.name, known.state || state) : {};
      const finalType = known.type ?? type;
      const finalState = known.state ?? state;
      return {
        provider_name: entry.name,
        provider_type: finalType,
        state: finalState,
        description:
          known.description ??
          typeDescription(entry.name, finalType, finalState, entry.descriptions[0]),
        email: known.email ?? lga.email ?? "",
        contact_number: known.contact_number ?? lga.contact_number ?? "",
        address: [...entry.councils].slice(0, 3).join("; "),
        website: known.website ?? lga.website ?? "",
        payment_method: "",
        payment_details: "",
      };
    })
    .sort((a, b) => a.provider_name.localeCompare(b.provider_name));

  const outHeaders = [
    "provider_name",
    "provider_type",
    "state",
    "description",
    "email",
    "contact_number",
    "address",
    "website",
    "payment_method",
    "payment_details",
  ];
  const csv = [
    outHeaders.join(","),
    ...providers.map((p) => outHeaders.map((h) => csvEscape(p[h])).join(",")),
  ].join("\n");
  const outPath = join(outputDir, "providers-all.csv");
  writeFileSync(outPath, csv, "utf8");

  const withWeb = providers.filter((p) => p.website).length;
  const withEmail = providers.filter((p) => p.email).length;
  const withPhone = providers.filter((p) => p.contact_number).length;
  const byType = {};
  for (const p of providers) byType[p.provider_type] = (byType[p.provider_type] ?? 0) + 1;
  console.log(`Wrote ${providers.length} providers → ${outPath}`);
  console.log("By type:", byType);
  console.log(`Website: ${withWeb}  Email: ${withEmail}  Phone: ${withPhone}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
