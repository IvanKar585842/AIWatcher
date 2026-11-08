import { MonitoringMode } from "@prisma/client";
import { MARKETPLACES, lookupMarketplace, marketplaceCommercialUse } from "../src/lib/monitoring/marketplace/catalog";
import { amazonLocale } from "../src/lib/monitoring/marketplace/http";
import { ebayMarketplaceIdForHost } from "../src/lib/monitoring/marketplace/ebay-browse";
import { describeSource } from "../src/lib/monitoring/sources/describe";
import { runSourceCheck } from "../src/lib/monitoring/sources/registry";
import { compareStructuredFields, extractStructuredFields } from "../src/lib/monitoring/structured-compare";

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

async function main() {
  const domains = new Set(MARKETPLACES.map((entry) => entry.domain));
  assert("catalog lists at least 150 marketplaces", MARKETPLACES.length >= 150, String(MARKETPLACES.length));
assert("catalog domains are unique", domains.size === MARKETPLACES.length);

const closed = ["zalando.de", "ozon.ru", "shopee.sg", "wildberries.ru", "coupang.com", "mercadolibre.com.ar", "conrad.de", "scan.co.uk", "macys.com", "bhphotovideo.com", "mediamarkt.pl", "e.leclerc"];
for (const domain of closed) {
  const found = lookupMarketplace(domain);
  assert(`${domain} is recognized and opened as a public page`, found?.access === "public-page", found?.access);
}

assert("amazon.se uses the Swedish Creators locale", amazonLocale("www.amazon.se")?.currency === "SEK");
assert("ebay.de selects EBAY_DE from the hostname", ebayMarketplaceIdForHost("www.ebay.de") === "EBAY_DE");
assert("an unknown host is not forced to EBAY_US", ebayMarketplaceIdForHost("example.com") === null);
assert(
  "Amazon stays unapproved for paid comparison",
  marketplaceCommercialUse(lookupMarketplace("amazon.de")!) === "requires_clarification"
);
assert(
  "a public storefront is not described as an official API",
  marketplaceCommercialUse(lookupMarketplace("zalando.de")!) === "public_page"
);
assert(
  "Amazon copy says paid use is not approved",
  describeSource("https://www.amazon.de/dp/B0TESTAS01").detail.includes("not approved")
);

const zalando = describeSource("https://www.zalando.de/product");
assert("zalando is shown as a public storefront", zalando.support === "webpage" && zalando.label === "Zalando");

let fetches = 0;
const shopee = await runSourceCheck("https://www.shopee.sg/product/1", {
  fetchImpl: async () => {
    fetches += 1;
    return new Response("nope", { status: 200 });
  },
});
assert("shopee is left to the public page monitor", shopee === null && fetches === 0);

const offer = extractStructuredFields(
  `<html><title>Banner 9.99 USD</title><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Lamp",
    offers: { "@type": "Offer", price: "49.00", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
  })}</script></html>`,
  "Banner 9.99 USD in stock"
);
assert(
  "structured product price wins over a banner price",
  offer.prices?.[0]?.value === 49 && offer.prices?.[0]?.currency === "EUR" && offer.availability === "in_stock" && offer.title === "Lamp"
);
const micro = extractStructuredFields(
  `<html><h1 itemprop="name">Coat</h1><span itemprop="price" content="80.00">£80.00</span><meta itemprop="priceCurrency" content="GBP"><link itemprop="availability" href="https://schema.org/OutOfStock"></html>`,
  "Shipping £4.00"
);
assert(
  "microdata price is used instead of a shipping price",
  micro.prices?.[0]?.value === 80 && micro.prices?.[0]?.currency === "GBP" && micro.availability === "out_of_stock" && micro.title === "Coat"
);
const homepage = extractStructuredFields(
  `<html><title>Shop &amp; Home</title><body>${"out of stock promo 10 € ".repeat(400)}</body></html>`,
  `${"out of stock promo 10 € ".repeat(400)}`
);
assert(
  "a large storefront home does not treat a promo price as the product",
  (homepage.prices?.length ?? 0) === 0 && homepage.availability === "unknown" && homepage.title === "Shop & Home"
);
const grid = (beta: string) =>
  ["Alpha", "Beta", "Gamma"]
    .map(
      (name) =>
        `<article class="product_pod"><h3><a title="${name}">${name}</a></h3><p class="price_color">${name === "Beta" ? beta : "£10.00"}</p></article>`
    )
    .join("");
const beforeGrid = extractStructuredFields(grid("£20.00"), "catalog");
const afterGrid = extractStructuredFields(grid("£21.00"), "catalog");
const gridDiff = compareStructuredFields({
  mode: MonitoringMode.ENTIRE_PAGE,
  previous: beforeGrid,
  current: afterGrid,
});
assert(
  "a product grid reports the named price change and not one page price",
  beforeGrid.listingsFound === true &&
    (beforeGrid.prices?.length ?? 0) === 0 &&
    (gridDiff?.summaryLines.some((line) => line.includes("Beta") && line.includes("20") && line.includes("21")) ?? false)
);
const listed = extractStructuredFields(
  `<script type="application/ld+json">${JSON.stringify({
    "@graph": [
      { "@type": "Product", name: "One", offers: { price: "1.00", priceCurrency: "USD" } },
      { "@type": "Product", name: "Two", offers: { price: "2.00", priceCurrency: "USD" } },
      { "@type": "Product", name: "Three", offers: { price: "3.00", priceCurrency: "USD" } },
    ],
  })}</script>`,
  "catalog"
);
assert("JSON-LD product lists stay individual items", listed.listingsFound === true && listed.items?.length === 3 && (listed.prices?.length ?? 0) === 0);
const shop = extractStructuredFields(
  `<ul>
    <li class="type-product"><h2 class="woocommerce-loop-product__title">Red</h2><span class="price">£5.00</span></li>
    <li class="type-product"><h2 class="woocommerce-loop-product__title">Blue</h2><span class="price">£6.00</span></li>
    <li class="type-product"><h2 class="woocommerce-loop-product__title">Green</h2><span class="price">£7.00</span></li>
  </ul>`,
  "shop"
);
assert("WooCommerce cards keep each product price", shop.listingsFound === true && shop.items?.[1]?.title === "Blue" && shop.items?.[1]?.price === 6);
assert("MDN is recognized as documentation", describeSource("https://developer.mozilla.org/en-US/docs/Web").label === "MDN");
assert("GitHub releases stay on the releases API", describeSource("https://github.com/nodejs/node/releases").adapter === "github-releases");

if (!process.exitCode) console.log(`marketplace catalog checks passed (${MARKETPLACES.length} entries)`);
}

main();
