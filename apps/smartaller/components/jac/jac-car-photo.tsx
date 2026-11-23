import Image from "next/image";
import { getJacCarPhoto } from "@/lib/brand/jac-photos";
import { cn } from "@/lib/utils";

type JacCarPhotoProps = {
  modelo?: string | null;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  src?: string;
};

export function JacCarPhoto({
  modelo,
  alt,
  className,
  sizes,
  priority,
  src,
}: JacCarPhotoProps) {
  const photo = src ?? getJacCarPhoto(modelo);
  return (
    <Image
      src={photo}
      alt={alt ?? modelo ?? "JAC"}
      fill
      sizes={sizes ?? "100vw"}
      className={cn("object-cover", className)}
      priority={priority}
    />
  );
}
