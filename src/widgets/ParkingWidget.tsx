import { HStack, Image, Link, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { aspectRatio, background, clipped, clipShape, containerBackground, cornerRadius, font, foregroundStyle, frame, minimumScaleFactor, padding, resizable, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

// Shows my parked car, else a spot someone shared with me that I accepted, else a "tap to photograph" prompt.
// Everything arrives as props (strings already translated by the app): the 'widget' runtime is isolated,
// so no imports of app code, hooks or module-scope constants.
export type ParkingWidgetProps = {
  kind?: 'mine' | 'shared'; // absent = nothing to show
  empty: string; // short "not parked" text for the lock screen
  hint: string; // "Tap to photograph your car"
  gotCar: string;
  directions: string;
  share: string;
  parkedLabel: string; // "Parked at"
  stillHere: string; // "Still parked"
  title?: string; // shared spots: "Nam's car"
  address?: string; // nearest place, e.g. "Vincom Center Đồng Khởi"
  note?: string; // e.g. "Cột A31"
  photo?: string; // file:// url inside the shared app-group dir
  parkedAt?: number; // ms epoch
  distance?: string; // "120 m from your car"
  distanceShort?: string; // "120 m"
  expiresText?: string; // "Expires 28/9": when the parking is forgotten unless renewed
  pickup?: string; // "Asked Nam to pick it up · waiting"
  pickupStatus?: 'open' | 'accepted' | 'declined';
  lat?: number;
  lng?: number;
  mapsUrl?: string; // directions link (the maps app the user chose, or a link back into the app)
  url?: string; // tap target for shared spots (the share screen)
};

const ParkingWidget = (props: ParkingWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const gold = '#FFD60A';
  const dark = '#0A0A0A';
  const has = props.kind !== undefined;
  const name = props.address ?? props.title ?? '';
  const when = new Date(props.parkedAt ?? 0);
  const link = props.url ? [widgetURL(props.url)] : [];
  const maps = props.mapsUrl ?? '';

  switch (env.widgetFamily) {
    case 'accessoryInline':
      return <Text>{has ? `🚗 ${props.note ?? name}` : props.empty}</Text>;
    case 'accessoryCircular':
      return <Image systemName="car.fill" size={26} />;
    case 'accessoryRectangular':
      return (
        <VStack alignment="leading">
          <Text modifiers={[font({ weight: 'bold' })]}>{has ? name : props.empty}</Text>
          {has && props.note ? <Text>{props.note}</Text> : null}
          {has && props.distance ? <Text>{props.distance}</Text> : null}
        </VStack>
      );
  }

  if (!has) {
    return (
      <VStack spacing={10} modifiers={[containerBackground(dark, 'widget')]}>
        <Spacer />
        <Image systemName="camera.fill" size={env.widgetFamily === 'systemMedium' ? 34 : 30} color={gold} />
        <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle('#FFFFFF'), padding({ horizontal: 12 })]}>{props.hint}</Text>
        <Spacer />
      </VStack>
    );
  }

  // capsule button: SF Symbol + label
  const button = (
    text: string,
    destination: string,
    filled: boolean,
    symbol: 'checkmark.circle.fill' | 'arrow.triangle.turn.up.right.diamond.fill' | 'square.and.arrow.up' | 'arrow.clockwise',
  ) => (
    <Link
      destination={destination}
      modifiers={[frame({ maxWidth: 9999 }), padding({ vertical: 5 }), background(filled ? gold : '#2A2A2A'), clipShape('capsule')]}
    >
      <HStack spacing={3}>
        <Image systemName={symbol} size={11} color={filled ? dark : gold} />
        <Text modifiers={[font({ weight: 'bold', size: 11 }), foregroundStyle(filled ? dark : gold), minimumScaleFactor(0.7)]}>{text}</Text>
      </HStack>
    </Link>
  );

  if (env.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={10} modifiers={[padding({ all: 6 }), containerBackground(dark, 'widget'), ...link]}>
        <Image
          uiImage={props.photo}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: 140, maxHeight: 9999 }), clipped(), cornerRadius(18)]}
        />
        <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: 9999, maxHeight: 9999, alignment: 'topLeading' }), padding({ vertical: 4 })]}>
          {props.kind === 'shared' && props.title ? <Text modifiers={[font({ size: 12 }), foregroundStyle('#8E8E93')]}>{props.title}</Text> : null}
          <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle('#FFFFFF'), minimumScaleFactor(0.7)]}>{name}</Text>
          {props.note ? <Text modifiers={[font({ weight: 'heavy', size: 19 }), foregroundStyle(gold), minimumScaleFactor(0.6)]}>{props.note}</Text> : null}
          <HStack spacing={6}>
            <HStack spacing={3}>
              <Text modifiers={[font({ size: 11 }), foregroundStyle('#8E8E93')]}>{props.parkedLabel}</Text>
              <Text date={when} dateStyle="time" modifiers={[font({ weight: 'bold', size: 11 }), foregroundStyle(gold)]} />
            </HStack>
            <Spacer />
            {props.distanceShort ? (
              <HStack spacing={2}>
                <Image systemName="figure.walk" size={11} color={gold} />
                <Text modifiers={[font({ weight: 'bold', size: 11 }), foregroundStyle('#FFFFFF'), minimumScaleFactor(0.7)]}>{props.distanceShort}</Text>
              </HStack>
            ) : null}
          </HStack>
          {props.expiresText ? <Text modifiers={[font({ size: 10 }), foregroundStyle('#8E8E93'), minimumScaleFactor(0.7)]}>{props.expiresText}</Text> : null}
          <Spacer />
          {props.pickup ? (
            <Text
              modifiers={[
                font({ weight: 'semibold', size: 10 }),
                foregroundStyle(props.pickupStatus === 'accepted' ? '#30D158' : props.pickupStatus === 'declined' ? '#FF453A' : '#FFD60A'),
                minimumScaleFactor(0.7),
              ]}
            >
              {props.pickup}
            </Text>
          ) : null}
          {props.kind === 'mine' ? (
            <VStack spacing={4}>
              <HStack spacing={5}>
                {button(props.gotCar, 'myparking://gotcar', true, 'checkmark.circle.fill')}
                {button(props.stillHere, 'myparking://renew', false, 'arrow.clockwise')}
              </HStack>
              <HStack spacing={5}>
                {button(props.directions, maps, false, 'arrow.triangle.turn.up.right.diamond.fill')}
                {button(props.share, 'myparking://share', false, 'square.and.arrow.up')}
              </HStack>
            </VStack>
          ) : (
            button(props.directions, maps, true, 'arrow.triangle.turn.up.right.diamond.fill')
          )}
        </VStack>
      </HStack>
    );
  }

  // systemSmall: just the photo, edge to edge, with the note on it at the bottom centre.
  return (
    <ZStack alignment="bottom" modifiers={[containerBackground(dark, 'widget'), ...link]}>
      <Image
        uiImage={props.photo}
        modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ maxWidth: 9999, maxHeight: 9999 }), clipped()]}
      />
      {props.note ? (
        <Text
          modifiers={[
            font({ weight: 'bold', size: 15 }),
            foregroundStyle(gold),
            minimumScaleFactor(0.7),
            padding({ vertical: 7, horizontal: 14 }), // even all round: works for "B1" and for marked letters like "Trọ"
            background(dark),
            clipShape('capsule'),
            padding({ bottom: 12 }),
          ]}
        >
          {props.note}
        </Text>
      ) : null}
    </ZStack>
  );
};

export default createWidget<ParkingWidgetProps>('ParkingWidget', ParkingWidget);
