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

Minimal example:

```yaml
type: custom:wizard-clock-card
locations:
  - Home
  - Work
  - School
wizards:
  - entity: person.alex
    name: Alex
    colour: "#AC5500"
    textcolour: "#fff"
  - entity: person.sam
    name: Sam
    colour: "#CC5500"
    textcolour: "#fff"
fontname: Lumos
fontpath: /local/community/weasley-card/LUMOS.TTF
fontformat: truetype
width: 500
lost: Lost
travelling: Travelling
```

### Core

* **locations**: Locations to keep visible on the clock face. Other locations can still appear dynamically.
* **wizards**: The hands shown on the clock. Each wizard needs an `entity` and `name`.
* **entity**: The entity used for the wizard's current location.
* **person_entity** or **more_info_entity**: Optional entity to open when the hand is clicked.
* **travel_status_entity**: Optional separate entity for travel/location state when `entity` is used for the popup.
* **exclude**: Locations that should never show; matching wizards fall back to the lost state.
* **lost**: Text used when an entity cannot be placed. Defaults to `Lost`.
* **travelling**: Text used when movement is detected. Defaults to `Travelling`.
* **width**: Clock size in pixels. Defaults to `500`.

### Font

* **fontname**: Font family used by the card. This should match the font's internal family name.
* **fontpath** or **font_path**: Font file URL served by Home Assistant.
* **fontformat** or **font_format**: Font type, such as `woff2`, `woff`, `truetype`, or `opentype`.
* **font_cache_buster**: Optional version string added to `fontpath` to help refresh cached fonts.
* **fontface**: Advanced custom `@font-face` body. If this is used without `fontpath`, the card does not also load the default Lumos file.

Custom font example:

```yaml
fontname: CustomFont
fontpath: /local/community/weasley-card/custom-font.woff2
fontformat: woff2
font_cache_buster: custom-font-1
```

### Clock Text

* **location_text.text_to_edge**: Moves location labels outward or inward.
* **location_text.font_size_max**: Normal location label size.
* **location_text.font_size_min**: Smallest size used when labels need to fit.
* **location_text.wrap**: Allows long location names to split over multiple lines.
* **location_text.max_lines**: Maximum wrapped lines.
* **location_text.text_gap**: Extra space kept between neighbouring labels.
* **location_text.line_spacing**: Space between wrapped lines.

### Hands

* **hands.length_scale**: Adjusts hand length.
* **hands.width_scale**: Adjusts hand width.
* **hands.location_spread**: Controls how hands fan out when multiple wizards are at one location.
* **hand_text.offset**: Moves wizard names along the hand.
* **hand_text.x_offset**: Moves wizard names across the hand.
* **hand_text.font_scale**: Adjusts wizard name size.

### Effects

* **location_animation**: Animates location labels when they appear, disappear, or move.
* **arrival_sparkle**: Adds a sparkle effect when a hand arrives at a new location.
* **hand_trail**: Shows a faded trail while a hand is moving.
* **location_filter**: Lets a populated location label be clicked to highlight its hands.
* **recent_movement**: Adds a temporary glow after a hand changes location.
* **avatars**: Adds initials, entity pictures, or local images to hand tips. GIF files animate automatically.

### Testing

* **test_enable**: Enables front-end-only test controls.
* **test_controls_hidden**: Starts with test buttons hidden while test hands remain active.
* **test_view_hidden**: Starts with the whole test view hidden.
* **test_unlock_clicks**: Allows five quick clock-face taps to show or hide the test view.
* **test_controls.locations**: Shared test locations.
* **test_controls.wizards**: Fake wizards for testing movement and animations.

Simple test example:

```yaml
test_enable: true
test_controls_hidden: true
test_view_hidden: true
test_unlock_clicks: true
test_controls:
  locations:
    - Home
    - Work
    - Shops
  wizards:
    - name: Test Wizard
      colour: "#7A2F9A"
      textcolour: "#fff"
      initial_location: Random
      random_zones: true
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

