export const projectSections = ['projecte', 'ajuda', 'fonts', 'privacitat', 'contacte'] as const
export type ProjectSection = typeof projectSections[number]
export const projectPageTitles: Record<ProjectSection, string> = { projecte: 'Sobre el projecte', ajuda: 'Ajuda', fonts: 'Fonts i crèdits', privacitat: 'Privacitat', contacte: 'Contacte' }
export const supportUrl = 'https://github.com/gonsals/100CimsCat/issues/new'
export const sourceUrl = 'https://github.com/gonsals/100CimsCat'
export const projectOwner = 'Marc Gonzalez Tarrio'
export const contactEmail = 'marcgonzaleztarrio@gmail.com'
