import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface TenantBrand {
  brandName: string;
  brandWebsite: string;
  supportEmail: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

const DEFAULT_BRAND: TenantBrand = {
  brandName: "Aster & Spruce",
  brandWebsite: "https://asterandspruceliving.ca",
  supportEmail: "info@asterandspruceliving.ca",
  logoUrl: null,
  primaryColor: null,
};

export function useTenantBrand(): TenantBrand {
  const { data } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_settings")
        .select("brand_name, brand_website, support_email, logo_url, primary_color")
        .eq("tenant_key", "default")
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  if (!data) return DEFAULT_BRAND;

  return {
    brandName: data.brand_name ?? DEFAULT_BRAND.brandName,
    brandWebsite: data.brand_website ?? DEFAULT_BRAND.brandWebsite,
    supportEmail: data.support_email ?? DEFAULT_BRAND.supportEmail,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
  };
}
