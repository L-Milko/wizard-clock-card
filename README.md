# WizardClock
A wizarding/location "clock" Lovelace component for Home Assistant

<img src="example.png" alt="Example wizarding clock" width="400">

## About

I was suprised when I couldn't find something like this that somebody else had already made, so decided to give it a go myself! It took a few months due to not having much spare time, and javascript not being my first language, but I eventually got it working quite nicely for my purposes. It looks (and is) pretty basic so far.

I decided to make it public so that other (more skillful) people could make use of it and tweak it to improve it/make it look nicer - if you do use it and make any improvements please let me know so that I can incorporate them into my code!


## Features

* Shows the friendly name of the current Zone that a person/entity is located in 
* If a person/entity isn't in a Zone then it marks that entity as "Lost" (can be customised)
* If an entity has a velocity of greater than 15 or their proximity direction sensor shows movement, it marks that entity as "Travelling" (supports both owntracks velocity and Home Assistant proximity integration)
* Locations are added dynamically as needed, however you can configure permanently shown locations by adding them to the "locations" list in the config
* For family members without a phone (or those that don't want to be tracked with owntracks!) it can use the google calendar platform - simply create a calendar with the expected locations of that person as the name of appointments at the appropriate times
* Font face can be customised (I use "Blackadder" for a suitably wizardy look)
* Hand colour (and text colour on the hands) can be customised for each person
* Hands animate fairly smoothly between states
* "Lost" and "Travelling" state text can be customised
* Supports right-to-left (RTL) languages like Hebrew and other RTL languages


## Installation

### HACS

Use this repository as a custom repository in HACS.

### Manual

1. Copy wizard-clock-card.js to www/custom-lovelace/ in your home assistant folder, along with any particular font you want to use.
2. Go to Settings -> Dashboards, then hit the three dots to open the custom Resources editor.
3. Select "JavaScript Module" as the resource type, then add the URL "/local/custom-lovelace/wizard-clock-card.js?v=1" (note if you put the javascript file somewhere other than www/custom-lovelace/ you'll need to modify this accordingly).
5. Hit save.
6. Edit the dashboard you want to add it to, then add a "Manual" card. 
7. Add your config, see the example below


#### Updating

1. Copy the updated wizard-clock-card.js over the old version
2. Edit the url in the Resources editor to increment the version number, e.g:

  ```
  /local/custom-lovelace/wizard-clock-card.js?v=2
  ```
  

## Config

* locations (optional): a list of locations that are permanently visible, others are added/removed as required
* exclude (optional): a list of locations that shall never be displayed, wizards at those locations will default to the `lost` state
* min_location_slots (optional): the minimum number of locations to save space for around the dial of the clock 
* wizards (required): a list of entities and display names for the device trackers/calendars used to represent your wizards. Now also supports setting individual colours for the hands/text.
  * entity: the entity used to decide where this hand points.
  * person_entity or more_info_entity: the entity to open when the hand is clicked/tapped. Use a `person.*` entity here if your hand is driven by a travel-status sensor but you want Home Assistant's person/map popup.
  * travel_status_entity: optional separate entity used for travel status/location logic when `entity` should remain the popup entity.
  * avatar: optional per-wizard hand tip mode. Use `default` for an initial marker, `avatar` for a Home Assistant entity picture, or `none`.
  * avatar_entity: optional entity to read `entity_picture` from when `avatar: avatar`.
  * avatar_url or avatar_image: optional direct image URL or local filename such as `harry.png`, `harry.jpg`, or `harry.gif`.
  * avatar_offset: per-wizard marker offset along the hand. Positive values move it toward the centre; negative values move it past the hand tip.
  * avatar_ring_colour: per-wizard marker border colour.
  * image_up: per-wizard toggle to keep the avatar image/initial upright instead of rotating with the hand.
  * show_name: per-wizard hand name toggle.
  * hand_text: optional per-wizard hand name settings.
    * name: text shown on the hand. Defaults to the wizard `name`.
    * offset: pixels to move the name along the hand. Positive values move it toward the hand tip; negative values move it toward the centre.
    * x_offset: pixels to move the name across the hand after readability rotation.
    * font_scale: per-wizard multiplier for hand name size.
    * font_size: exact per-wizard hand name font size in canvas pixels.
* fontname (optional): the font family name to use in the clock, defaults to `Lumos`. This must match the real internal font family name inside the font file.
* fontpath or font_path (optional): the main font URL Home Assistant can serve, defaults to `/local/community/weasley-card/LUMOS.TTF`. Put the font in the same `www/community/weasley-card` folder as the card files, or point this at another font file.
* font_cache_buster (optional): version string appended to `fontpath` so mobile apps/browsers reload the font after you replace it
* font_fallback_name (optional): another font family name to try for legacy font files
* fontformat or font_format (optional): the font format for `fontpath`, such as `woff2`, `woff`, `truetype`, or `opentype`.
* fontface (optional): a full `@font-face` body for advanced custom loading. When `fontface` is provided without `fontpath`, the card will not also inject the default Lumos file.
* location_text (optional): settings for the text around the clock edge.
  * offset: pixels to move location labels outward. Use negative values to move inward.
  * text_to_edge: alias for `offset`, useful for tuning how close location text sits to the clock edge.
  * font_scale: multiplier for location label size.
  * font_size_max: normal/default location label font size in canvas pixels. If set, this overrides `font_scale`.
  * font_size_min: smallest location label font size in canvas pixels when auto-fit needs to shrink crowded text.
  * font_size: older alias for `font_size_max`.
  * auto_fit: shrink long labels when needed so they fit their slice of the clock.
  * min_font_scale: fallback smallest multiplier auto-fit can use when `font_size_min` is not set.
  * slot_padding: how much of each location slice text may use before auto-fit shrinks it.
  * slot_gap or text_gap: extra left/right pixels reserved between crowded location labels. Larger values force labels to wrap or shrink sooner.
  * wrap: split long multi-word labels onto multiple curved lines when needed.
  * max_lines: maximum wrapped lines for a location label.
  * line_spacing: spacing between wrapped location label lines.
  * line_gap: extra vertical/radial pixels between wrapped location label lines.
  * Wrapped labels keep the outside-most line on the normal clock-edge arc and stack the other lines inward while preserving readable word order.
  * Smaller fitted labels stay centered on the same clock-edge arc as normal labels.
* location_animation (optional): magical animation for location labels as they appear and disappear.
  * enabled: turn the effect on or off.
  * duration: milliseconds each letter takes to fade/float between the center and the clock edge.
  * letter_stagger: milliseconds between each letter starting its animation.
  * angle_duration: milliseconds existing labels take to slide into new positions when locations are added or removed.
* arrival_sparkle (optional): sparkle burst when a hand changes to a new location.
  * enabled: turn sparkle arrivals on or off.
  * duration: milliseconds the sparkle burst lasts.
  * count: number of sparkle dots.
  * radius: how far the dots drift from the hand tip.
* hand_trail (optional): faded copies of moving hands, using each hand's own colour.
  * enabled: turn trails on or off.
  * length: how many movement samples to keep.
  * alpha: opacity of the trail.
  * width_scale: trail width compared with the main hand.
* location_filter (optional): tap/click a location label to dim hands that are not there; tap the same label again to clear.
  * enabled: turn location filtering on or off.
  * dim_alpha: opacity for hands outside the selected location.
  * spread: how far hands at the selected location fan out while the filter is active.
  * auto_off: milliseconds before the selected location filter clears itself. Use `0` to keep it on until tapped again.
  * Locations with fewer than two hands are ignored when tapped/clicked.
* recent_movement (optional): temporary glow around hands that have recently changed location.
  * enabled: turn the indicator on or off.
  * duration: milliseconds the glow remains visible.
  * glow_blur: size of the glow.
  * fade_in: milliseconds the glow takes to fade in before the duration countdown starts.
  * frame_ms: milliseconds between glow redraws after movement. Larger values are lighter on tablets.
* avatars (optional): draw a small tip marker at the end of each hand.
  * enabled: turn hand tip markers on or off.
  * mode: default mode for all wizards. Use `default` for an initial marker, `avatar` for Home Assistant entity pictures, or `none`.
  * size: marker size in canvas pixels.
  * ring_width: marker border size.
  * ring_colour: default marker border colour.
  * offset: pixels to move the marker along the hand. Positive values move it toward the centre; negative values move it past the hand tip.
  * show_name: show or hide wizard names on hands by default.
  * image_path: base path for local avatar images next to the card file, defaults to `/hacsfiles/weasley-card/`.
  * `.gif` avatar images are played by default using an image overlay.
  * image_up: keeps avatar images/initials upright instead of rotating with the hand. Defaults to `false` to preserve the current behavior.
* hand_text (optional): settings for wizard names on clock hands.
  * offset: pixels to move hand names toward the hand tip. Use negative values to move toward the center.
  * x_offset: pixels to move hand names away from/toward the bottom of the text after it is rotated for readability, so the direction is consistent around the clock.
  * font_scale: multiplier for hand name size.
  * Per-wizard `hand_text` settings can override these defaults for individual names.
* hands (optional): settings for hand shape and how hands share the same location.
  * length_scale: multiplier for hand length.
  * width_scale: multiplier for hand width.
  * location_spread: how far hands fan out when multiple wizards are at the same location. A wizard alone at a location points directly at it.
* shaft_colour (optional): the colour of the shaft
* lost (optional): text to display when an entity is lost, defaults to "Lost". 
* travelling (optional): text to display when an entity is travelling, defaults to "Travelling"
* width (optional): set the width (and therefore height, as it is always a circle) of the clock in pixels. Defaults to 500 if not set.
* show_version (optional): shows a small debug line under the clock with the loaded card version and key live settings. Useful when checking whether the Home Assistant mobile app has cached an older JavaScript file.
* test_enable (optional): turns front-end-only test controls on or off. Keep this `false` when you want the card to ignore the saved test setup.
* test_controls_hidden (optional): keeps the test hand active but hides the test buttons on first load. Clicking/tapping the fake test hand still shows or hides the buttons.
* test_view_hidden (optional): keeps the saved test setup hidden on first load, including fake test hands. Use this with `test_enable: true` when you want test available but invisible.
* test_unlock_clicks (optional): lets five fast clicks/taps on the clock face toggle the test view. With `test_view_hidden: true` it reveals/hides the hidden test view; with `test_view_hidden: false` it hides/shows the visible test view. Defaults to `true` when `test_view_hidden` is enabled.
* test_random_zones (optional): starts `+Zones` enabled for Random test movement unless a test wizard overrides it.
* test_controls (optional): saved front-end-only button setup for testing movement and dynamic location animation without changing Home Assistant states.
  * locations: button locations shared by test wizards. These are not copied from the main card `locations`; add names like `Home` here too when you want test wizards to use the same clock-face location.
  * random_zones: starts `+Zones` enabled for all test wizards in this test setup.
  * wizards: optional fake/test wizards to add to the clock. If omitted, buttons are shown for the normal configured wizards.
  * locations: per-wizard extra test locations. These are added to the shared `test_controls.locations` for that wizard only.
  * initial_location: starting location for a fake/test wizard. Use `Random` to start that wizard in Random mode.
  * random_zones: per-wizard override for whether `+Zones` starts enabled.
  * Random: the generated button moves that test wizard to a random shared or per-wizard test location, then keeps choosing another random location every 0 to 5 minutes while active. Clicking any specific location button turns Random off for that wizard.
  * +Zones: shown while Random is active. When enabled, Random can also pick Home Assistant `zone.*` friendly names in addition to the configured test locations.
  * Clicking/tapping a fake test hand hides or shows the test controls without turning Random off.

Default text positioning can also be edited near the top of `wizard-clock-card.js`:

```
DEFAULT_LOCATION_TEXT_OFFSET
DEFAULT_LOCATION_TEXT_FONT_SCALE
DEFAULT_HAND_TEXT_OFFSET
DEFAULT_HAND_TEXT_X_OFFSET
DEFAULT_HAND_TEXT_FONT_SCALE
DEFAULT_HAND_LENGTH_SCALE
DEFAULT_HAND_WIDTH_SCALE
DEFAULT_HAND_LOCATION_SPREAD
DEFAULT_LOCATION_ANIMATION_ENABLED
DEFAULT_LOCATION_ANIMATION_DURATION
DEFAULT_LOCATION_ANIMATION_LETTER_STAGGER
DEFAULT_LOCATION_ANIMATION_ANGLE_DURATION
DEFAULT_LOCATION_TEXT_AUTO_FIT
DEFAULT_LOCATION_TEXT_MIN_FONT_SCALE
DEFAULT_LOCATION_TEXT_SLOT_PADDING
DEFAULT_LOCATION_TEXT_SLOT_GAP
DEFAULT_LOCATION_TEXT_WRAP
DEFAULT_LOCATION_TEXT_MAX_LINES
DEFAULT_LOCATION_TEXT_LINE_SPACING
DEFAULT_LOCATION_TEXT_LINE_GAP
```

```
type: 'custom:wizard-clock-card'
locations:
  - Home
  - Work
  - School
min_location_slots: 5
wizards:
  - entity: device_tracker.harrys_phone
    name: Harry
    person_entity: person.harry
    proximity_sensor: sensor.home_harry_direction_of_travel
    colour: '#F00'
    textcolour: '#00F'
    avatar: avatar
    hand_text:
      name: Harry
      offset: 8
      x_offset: 0
      font_size: 24
  - entity: device_tracker.hermiones_phone
    name: Hermione
    person_entity: person.hermione
    colour: '#0F0'
    avatar: default
    hand_text:
      offset: 2
      font_scale: 0.85
  - entity: calendar.ron
    name: Ron
  - entity: calendar.ginny
    name: Ginny
fontname: Lumos
fontpath: /local/community/weasley-card/LUMOS.TTF
fontformat: truetype
font_cache_buster: lumos-2
location_text:
  offset: 8
  text_to_edge: 8
  font_scale: 1.1
  font_size_max: 38
  font_size_min: 26
  auto_fit: true
  min_font_scale: 0.75
  slot_padding: 0.88
  text_gap: 8
  wrap: true
  max_lines: 2
  line_spacing: 0.9
  line_gap: 0
location_animation:
  enabled: true
  duration: 900
  letter_stagger: 55
  angle_duration: 700
arrival_sparkle:
  enabled: true
  duration: 1400
  count: 10
  radius: 22
hand_trail:
  enabled: true
  length: 12
  alpha: 0.22
  width_scale: 0.85
location_filter:
  enabled: true
  dim_alpha: 0.25
  spread: 1.1
  auto_off: 10000
recent_movement:
  enabled: true
  duration: 300000
  glow_blur: 18
  fade_in: 1000
  frame_ms: 300
avatars:
  enabled: true
  mode: default
  size: 34
  ring_width: 3
  ring_colour: "#fff"
  offset: 0
  show_name: true
  image_path: /hacsfiles/weasley-card/
  image_up: false
hand_text:
  offset: 6
  x_offset: 0
  font_scale: 1.0
hands:
  length_scale: 0.75
  width_scale: 0.1
  location_spread: 0.6
show_version: true
width: 500
lost: 'In mortal peril'
travelling: 'Between here and there'
```

Example using a different font file from the card folder:

```
fontname: NewFont
fontpath: /local/community/weasley-card/newFont.woff2
fontformat: woff2
font_cache_buster: newfont-1
```

Example using a full custom `fontface` instead of `fontpath`:

```
fontname: NewFont
fontface: >-
  font-family: NewFont; src:
  url('/local/community/weasley-card/newFont.woff2?v=newfont-1') format('woff2');
```

Example front-end-only test controls:

```
type: custom:wizard-clock-card
locations:
  - Home
  - Work
  - C Springs
wizards:
  - entity: sensor.luka_travel_status
    name: Luka
    person_entity: person.luka
    colour: "#AC5500"
    textcolour: "#fff"
  - entity: sensor.brooke_travel_status
    name: Brooke
    person_entity: person.brooke
    colour: "#CC5500"
    textcolour: "#fff"
test_enable: true
test_controls_hidden: true
test_view_hidden: false
test_unlock_clicks: true
test_random_zones: false
test_controls:
  random_zones: true
  locations:
    - Home
    - Work
    - C Springs
    - Hogwarts
    - Travelling
    - Lost
  wizards:
    - name: Harry
      colour: "#7A2F9A"
      textcolour: "#fff"
      initial_location: Random
      random_zones: true
      locations:
        - Home
        - Hogwarts
        - Hogsmeade
    - name: Ron
      colour: "#fa2f2f"
      textcolour: "#fff"
      initial_location: Random
      random_zones: false
      locations:
        - Home
        - C Springs
        - The Burrow
show_version: true
```

## Wishlist

These are features/ideas that I'd like to add at some point, but may not happen any time soon. Feel free to add them yourself and share your code if you're able!

* ~~Animations: Changes in status produce nicely animated transitions instead of just jumping about~~ Basic animations with ease-out now working, could do with ease-in too. Or possibly just going a bit mad and spinning round a couple of times before easing to the new location...
* Make pretty: It looks fairly basic at the moment (I'm no artist!).

  * ~~Maybe include support for themes too, if that's possible?~~ Colours are now taken from whatever theme you are using by default. Hand/text colour for each wizard can be overridden if desired... so it's getting there.
  * Add pictures on clock hands taken from people/entities or possibly zones? Or even a combination of both, so person x at location y has a special "person x at location y" picture.
  * Add config options for clock face colours, including the ability to make them transparent.
  
* Better support for "speed" attributes, including for person entities looking up the speed from their current device tracker source
* Better text rendering - this goes along with making it pretty, ~~perhaps include drawing the text in arcs around the outside of the clock~~, and handling longer location/wizard names better. Arc text now done, with code nicked from somebody else :)
* Pre-load custom web font before rendering - if this is even possible?
* ~~Make available through HACS~~

