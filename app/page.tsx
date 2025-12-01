import { Header} from '@/components/Header'
import FeaturesSection from '@/components/home/features-section'
import HeroSection from '@/components/home/hero-section'

export default function page() {
  return (
    <div>
      <Header/>
      <HeroSection/>
      <FeaturesSection/>
      {/* <PricingSection/>
      <CtaSection/>
      <Footer/> */}
    </div>
  )
}
