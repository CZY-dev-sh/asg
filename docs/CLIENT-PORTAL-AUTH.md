# Client Portal Auth Setup

The client portal page at `/client-portal` uses Supabase Auth directly in the browser.

## Supabase Redirect URLs

In Supabase, go to **Authentication > URL Configuration** and add:

- `https://www.alexstoykovgroup.com/client-portal`
- `https://alexstoykovgroup.com/client-portal`
- `https://www.alexstoykovgroup.com/seller-onboarding`
- `https://alexstoykovgroup.com/seller-onboarding`
- `https://www.alexstoykovgroup.com/buyer-onboarding`
- `https://alexstoykovgroup.com/buyer-onboarding`

Keep the existing admin-console redirect URLs in place.

## Google Sign In

1. Go to **Authentication > Providers > Google** in Supabase.
2. Enable Google.
3. Add the Google OAuth client ID and secret from Google Cloud.
4. In Google Cloud, add the Supabase callback URL shown in the Supabase Google provider panel.

## Apple Sign In

Apple requires an Apple Developer account.

1. Create an Apple Services ID for the ASG website.
2. Add the Supabase Apple callback URL as the return URL.
3. Create an Apple private key for Sign in with Apple.
4. In Supabase, enable Apple and enter the Services ID, Team ID, Key ID, and private key.

## Phone OTP

Supabase phone login requires an SMS provider before texts can be delivered.

1. Go to **Authentication > Providers > Phone** in Supabase.
2. Enable Phone.
3. Connect Twilio or another supported SMS provider.
4. Test with a real mobile number from `/client-portal`.

## Frontend Config

The page defaults to the current ASG Supabase project:

- `window.ASG_SUPABASE_URL`
- `window.ASG_SUPABASE_ANON_KEY`
- `window.ASG_API_BASE`

Override those before the code block if a staging backend or staging Supabase project is needed.

## Onboarding Gate

The buyer and seller onboarding pages now open the account modal before the user can begin the form.

- Seller onboarding saves and submits through `/api/portal/onboarding/seller-onboarding`.
- Buyer onboarding saves and submits through `/api/portal/onboarding/buyer-onboarding`.
- After submission, the client is redirected to `/client-portal`.
- If the client already completed that form, the onboarding page sends them directly to the portal.
