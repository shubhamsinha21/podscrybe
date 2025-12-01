import { Header} from '@/components/Header'
import CtaSection from '@/components/home/cta-section'
import FeaturesSection from '@/components/home/features-section'
import HeroSection from '@/components/home/hero-section'
import PricingSection from '@/components/home/pricing-section'

export default function page() {
  return (
    <div>
      <Header/>
      <HeroSection/>
      <FeaturesSection/>
      <PricingSection/>
      <CtaSection/>
      {/* <Footer/> */}
    </div>
  )
}
