# Manual-check list (for Phil)

Things I could not confirm from an official page. They are marked `verified: false` in the data
and flagged in the UI until you check them.

## Steps marked unverified

| Step | Why | Where to check |
|---|---|---|
| `cita_extranjeria` | The booking app would not load for automated reading (certificate error). Not confirmed: which procedure to pick for Málaga ("POLICIA-CERTIFICADO DE REGISTRO DE CIUDADANO DE LA U.E."?), whether the appointment is mandatory. | https://icp.administracionelectronica.gob.es/icpplus/index.html (open in a normal browser, choose Málaga) |
| `alta_employee` | Employer-side Social Security registration page not read. | https://sede.seg-social.gob.es/wps/portal/sede/sede/EmpresasyProfesionales/afiliacion+e+inscripcion/03afiliacion+e+inscripcion |
| `bank_account` | Banks are private; no official source exists. Kept because RETA asks for a bank account. | — (keep as unverified, or remove) |

## Requirements that are "common practice", not official rules

Drawn dashed in the app and labelled "common practice". No source.

| Requirement | Note |
|---|---|
| `eu_certificate` → `padron` | Not on the official document list (Policía Nacional, Interior). Often reported in real life. |
| `housing` → `eu_certificate` | Landlords and utility companies often ask for an NIE. |
| `bank_account` → `eu_certificate` | Banks commonly ask for an NIE. |

## Requirements that are my reading of the source

| Requirement | Note |
|---|---|
| `reta` → `alta_censal` | Seguridad Social says you must be registered with Hacienda (IAE) too and RETA asks for your IAE code. It does not state which comes first. |
| `alta_employee` → `job_offer` | Self-evident; no page read. |
| `eu_certificate` → `alta_censal` (autónomo) | Tax census registration is one of three accepted proofs (also Registro Mercantil or Social Security registration). All three end up needing the NIE, so the circle holds either way. |

## Pages that failed to load for automated reading

- https://extranjeros.inclusion.gob.es/… (certificate error) and https://www.inclusion.gob.es/web/migraciones/ (403). I used the Migraciones "Hoja 65" page instead, which points to the Policía Nacional page as the source of the requirements.
- The Hoja 65 PDF (certificate error).
- https://www.seg-social.es (empty page, rendered by JavaScript). I used the Import@ss pages at portal.seg-social.gob.es.
- The INSS health-care entitlement page (no content).

## Facts deliberately left out (no source read)

- Fee amounts for Modelo 790 Código 012.
- Waiting times for appointments.
- Whether modelo 037 still exists (the AEAT pages still cite it in legal references only).
