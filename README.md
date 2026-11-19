# Purebread Mount Pleasant: Nitro Dashboard

Live sales for the Nitro Salted Brown Butter Oat Latte at Purebread 5th (Mount Pleasant), the three featured drinks (Nitro, Caramel Brulee Latte, Toasted Marshmallow Mocha), and progress paying off the nitro equipment. Data comes from Square's Reporting API and refreshes every 5 minutes while the page is open.

## Setup on Vercel

1. In Vercel, click **Add New > Project** and import this GitHub repo.
2. Before deploying, open **Environment Variables** and add:
   - `SQUARE_ACCESS_TOKEN`: a Square access token with `REPORTING_READ` permission (Square Developer Dashboard > your app > Credentials > Production access token).
   - `DASHBOARD_PASSWORD`: the password people type to see the page. Any username works.
3. Click **Deploy**.

## Changing things

Prices, the equipment cost, cost per drink and which drinks are featured all live in `lib/config.js`.

## Notes

- Net sales are after discounts and comps, before tax and tips.
- Square's reporting usually trails the till by a few minutes.
- The Square token stays on the server. It is never sent to the browser.
