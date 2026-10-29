import { describe, expect, it } from 'vitest'
import { productionLabs, productionLabUrl } from './productionLabBridge'
describe('Production-lab integration boundaries',()=>{
 it('maps the ten verified production pages without duplicates',()=>{
   expect(productionLabs).toHaveLength(10)
   expect(new Set(productionLabs.map(l=>l.id)).size).toBe(10)
   for(const lab of productionLabs) {
     expect(lab.path).toBe('/dashboard/student/'+lab.id+'/')
     expect(productionLabUrl(lab.path)).toMatch(/^https:\/\/app\.autolearnpro\.com\/dashboard\/student\//)
     expect(lab.boundary.length).toBeGreaterThan(25)
   }
 })
 it('does not advertise the Docker battery presets as authoritative production readings',()=>{
   for(const lab of productionLabs) expect(lab.boundary).not.toMatch(/12\.6 V|10\.5 V|11\.8 V/)
 })
 it('keeps cross-lab integration in a declared phase',()=>{
   expect(productionLabs.filter(l=>l.integrationPhase==='first').map(l=>l.id)).toEqual(['circuit-lab','circuit-lab-calculator'])
 })
})
