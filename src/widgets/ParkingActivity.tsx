import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  aspectRatio, background, clipped, clipShape, cornerRadius, font, foregroundStyle, frame, minimumScaleFactor, padding, resizable,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

// Lock-screen card + Dynamic Island while a car is parked. Props only (isolated 'widget' runtime).
// Buttons are links: "Directions" opens the chosen maps app (or the in-app chooser); the other two open the app
// (Live Activity intents can't reach JS when the app isn't running).
export type ParkingActivityProps = {
  title: string;
  gotCar: string;
  directions: string;
  share: string;
  parkedLabel: string; // "Parked at"
  parkedAt: number; // ms epoch
  lat: number;
  lng: number;
  mapsUrl: string; // directions link (the maps app the user chose, or a link back into the app)
  address?: string; // nearest place, e.g. "Vincom Center Đồng Khởi"
  note?: string; // e.g. "Cột A31"
  distance?: string; // "120 m from your car"
  distanceShort?: string; // "120 m"
  expiresText?: string; // "Expires 28/9": when the parking is forgotten unless renewed
  pickup?: string; // "Asked Nam to pick it up · waiting"
  pickupStatus?: 'open' | 'accepted' | 'declined';
  photo?: string; // file:// url in the shared app-group dir
};

const ParkingActivity = (props: ParkingActivityProps) => {
  'widget';
  const gold = '#FFD60A';
  const dark = '#0A0A0A';
  // iOS clips a Live Activity at ~160pt, so everything is sized to fit with room to spare:
  // the lock-screen card is a little roomier than the expanded island.
  const parkedAt = new Date(props.parkedAt);
  const car = <Image systemName="car.fill" color={gold} />;
  const pickupColor = props.pickupStatus === 'accepted' ? '#30D158' : props.pickupStatus === 'declined' ? '#FF453A' : '#8E8E93';

  // photo, text and distance share one height so they centre against each other
  const photo = (row: number, size: number) => (
    <VStack modifiers={[frame({ height: row })]}>
      <Spacer />
      {props.photo ? (
        <Image
          uiImage={props.photo}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fill' }), frame({ width: size, height: size }), clipped(), cornerRadius(size / 5)]}
        />
      ) : (
        <Image systemName="car.fill" size={size * 0.6} color={gold} />
      )}
      <Spacer />
    </VStack>
  );

  // place, note, "Parked at 14:32 · Expires 28/9", who was asked to pick it up
  const info = (row: number, small: number) => (
    <VStack alignment="leading" spacing={1} modifiers={[frame({ height: row })]}>
      <Spacer />
      <Text modifiers={[font({ weight: 'bold', size: small + 3 }), foregroundStyle('#FFFFFF'), minimumScaleFactor(0.7)]}>{props.address ?? props.title}</Text>
      {props.note ? <Text modifiers={[font({ weight: 'heavy', size: small + 5 }), foregroundStyle(gold), minimumScaleFactor(0.7)]}>{props.note}</Text> : null}
      <HStack spacing={3}>
        <Text modifiers={[font({ size: small }), foregroundStyle('#8E8E93')]}>{props.parkedLabel}</Text>
        <Text date={parkedAt} dateStyle="time" modifiers={[font({ weight: 'bold', size: small }), foregroundStyle(gold)]} />
        {props.expiresText ? <Text modifiers={[font({ size: small }), foregroundStyle('#8E8E93'), minimumScaleFactor(0.7)]}>{`· ${props.expiresText}`}</Text> : null}
      </HStack>
      {props.pickup ? <Text modifiers={[font({ weight: 'semibold', size: small }), foregroundStyle(pickupColor), minimumScaleFactor(0.6)]}>{props.pickup}</Text> : null}
      <Spacer />
    </VStack>
  );

  // walking distance on the right, centred like the other columns (shown once)
  const away = (row: number, icon: number) => (
    <VStack spacing={1} modifiers={[frame({ height: row })]}>
      <Spacer />
      {props.distanceShort ? (
        <>
          <Image systemName="figure.walk" size={icon} color={gold} />
          <Text modifiers={[font({ weight: 'bold', size: icon }), foregroundStyle('#FFFFFF'), minimumScaleFactor(0.7)]}>{props.distanceShort}</Text>
        </>
      ) : null}
      <Spacer />
    </VStack>
  );

  // capsule button: SF Symbol + label
  const button = (
    label: string,
    destination: string,
    filled: boolean,
    symbol: 'checkmark.circle.fill' | 'arrow.triangle.turn.up.right.diamond.fill' | 'square.and.arrow.up' | 'arrow.clockwise',
    size: number,
    pad: number,
  ) => (
    <Link
      destination={destination}
      modifiers={[frame({ maxWidth: 9999 }), padding({ vertical: pad }), background(filled ? gold : '#2A2A2A'), clipShape('capsule')]}
    >
      <HStack spacing={4}>
        <Image systemName={symbol} size={size + 1} color={filled ? dark : gold} />
        <Text modifiers={[font({ weight: 'bold', size }), foregroundStyle(filled ? dark : gold), minimumScaleFactor(0.7)]}>{label}</Text>
      </HStack>
    </Link>
  );
  const buttons = (size: number, pad: number, gap: number) => (
    <HStack spacing={gap}>
      {button(props.gotCar, 'myparking://gotcar', true, 'checkmark.circle.fill', size, pad)}
      {button(props.directions, props.mapsUrl, false, 'arrow.triangle.turn.up.right.diamond.fill', size, pad)}
      {button(props.share, 'myparking://share', false, 'square.and.arrow.up', size, pad)}
    </HStack>
  );

  return {
    // lock screen: 12 + 62 + 8 + 30 + 12 = ~125pt
    banner: (
      <VStack spacing={8} modifiers={[padding({ all: 12 }), background(dark)]}>
        <HStack spacing={10}>
          {photo(62, 56)}
          {info(62, 11)}
          <Spacer />
          {away(62, 15)}
        </HStack>
        {buttons(13, 7, 6)}
      </VStack>
    ),
    compactLeading: car,
    compactTrailing: props.distanceShort ? (
      <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(gold)]}>{props.distanceShort}</Text>
    ) : (
      <Text date={parkedAt} dateStyle="time" />
    ),
    minimal: car,
    // Dynamic Island, expanded: much less height than the banner (the camera area already takes the top)
    expandedLeading: <VStack modifiers={[padding({ all: 2 })]}>{photo(52, 46)}</VStack>,
    expandedCenter: <VStack modifiers={[padding({ all: 2 })]}>{info(52, 10)}</VStack>,
    expandedTrailing: <VStack modifiers={[padding({ all: 2 })]}>{away(52, 14)}</VStack>,
    expandedBottom: <VStack modifiers={[padding({ top: 2, bottom: 4 })]}>{buttons(12, 6, 6)}</VStack>,
  };
};

export default createLiveActivity<ParkingActivityProps>('ParkingActivity', ParkingActivity);
