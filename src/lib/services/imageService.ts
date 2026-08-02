import { supabase } from '../supabase';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES   = ['application/pdf'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;  // 5 MB
const MAX_DOC_SIZE_BYTES   = 10 * 1024 * 1024; // 10 MB

export const validateFile = (
  file: File,
  type: 'image' | 'document'
): { valid: boolean; error?: string } => {
  const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
  const maxSize      = type === 'image' ? MAX_IMAGE_SIZE_BYTES : MAX_DOC_SIZE_BYTES;

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size too large. Limit is: ${(maxSize / 1024 / 1024).toFixed(0)} MB`,
    };
  }
  return { valid: true };
};

export const imageService = {
  async createPresignedUploadUrl(
    userId: string,
    fileType: string,
    bucket = 'profiles'
  ): Promise<{ signedUrl: string; path: string; publicUrl: string } | null> {
    try {
      const fileExt = fileType.split('/')[1] || 'bin';
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error("[imageService] Error generating presigned upload URL:", error);
        return null;
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

      return {
        signedUrl: data.signedUrl,
        path: data.path,
        publicUrl: publicData.publicUrl
      };
    } catch (err) {
      console.error("[imageService] Exception in createPresignedUploadUrl:", err);
      return null;
    }
  },

  async compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
          }, 'image/jpeg', 0.7);
        };
      };
    });
  },

  async uploadFile(file: File | Blob, userId: string, bucket = 'profiles'): Promise<string> {
    const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const contentType = file instanceof File ? file.type : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { contentType, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicData.publicUrl;
  },

  async processAndUpload(file: File, userId: string, bucket = 'profiles'): Promise<string> {
    const fileType = file.type.startsWith('image/') ? 'image' : 'document';
    const validation = validateFile(file, fileType);
    if (!validation.valid) throw new Error(validation.error);

    if (file.type.startsWith('image/')) {
      const compressed = await this.compressImage(file);
      return this.uploadFile(compressed, userId, bucket);
    } else {
      return this.uploadFile(file, userId, bucket);
    }
  }
};
