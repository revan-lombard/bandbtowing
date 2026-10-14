/*
 * B&B Towing — site configuration.
 * Change business details here; every page reads from this file.
 */
window.BB_CONFIG = {
  businessName: "B&B Towing",

  // Number that receives booking requests on WhatsApp.
  // International format, digits only (South Africa = 27, drop the leading 0).
  // Testing number: 072 237 5833
  whatsappNumber: "27722375833",

  // Number for the "Call us" buttons (shown to customers as written below).
  phoneNumber: "+27722375833",
  phoneDisplay: "072 237 5833",

  // Default map view (roughly central Gauteng) used before a location is chosen.
  mapCenter: [-26.1, 28.05],
  mapZoom: 10,

  // Limit address search to these countries (ISO codes, comma separated).
  searchCountries: "za",

  // Future: automatic quotes. Set enabled to true and fill in the rates to show
  // customers an estimated price on the booking page and in the WhatsApp message.
  pricing: {
    enabled: false,
    currency: "R",
    callOutFee: 0,   // fixed fee per tow
    perKm: 0,        // rate per km of the route
    minimum: 0       // minimum charge
  }
};
