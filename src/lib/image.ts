import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Resize to `width` and re-encode as JPEG (one helper for photos, thumbnails and avatars).
export const resizeJpeg = async (uri: string, width: number, compress: number) => {
  const img = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  return img.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
};
