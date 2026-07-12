import { BulbMark, PixelFrame } from '../asset-kit'

// Facebook profile picture — upload 1080×1080; Facebook displays it as a
// circle, so the motif is dead-centred with generous margin. Reuses the
// favicon's exact gradient + bulb so every brand surface matches.
export const metadata = {
  title: { absolute: 'Facebook profile image — HadIdea (internal)' },
  robots: { index: false, follow: false },
}

export default function FacebookProfileAsset() {
  return (
    <PixelFrame w={1080} h={1080} label="Facebook profile">
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
      >
        <BulbMark size={680} />
      </div>
    </PixelFrame>
  )
}
