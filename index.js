const puppeteer = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

(async () => {
  //ajout d'une methode au type String pour nettoyer facilement
  String.prototype.cleanup = function() {
    //expression régulère pour remplace tout les elements qui ne sont pas [^A-zÀ-ÿ0-9]+/g par un espace
    return this.toLowerCase().replace(/[^A-zÀ-ÿ0-9]+/g, " ");
  }
  //init de puppeteer
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];
  //ajout du plugin stealth pour bypasser cloudflare
  puppeteer.use(stealthPlugin());
  const browser = await puppeteer.launch({headless: false,
    ignoreHTTPSErrors : true,
    args
  });
  const page = await browser.newPage(); //créer une nouvelle page
  await page.setUserAgent('Mozilla/5.0 (Windows NT 5.1; rv:5.0) Gecko/20100101 Firefox/5.0');//navigateur a utiliser
  await page.setExtraHTTPHeaders({//prévenir le site web de la langue utilisée
  'Accept-Language': 'fr'
});
  try{
    await page.goto('https://www.backmarket.fr/fr-fr/buyback-funnel/device/telephone/1#brand=1');// va sur la page demandé
    await page.click(`button[data-qa="accept-cta"]`);// click auto du bouton coockies
    let arrofOpts = [];
    //on recupère les différent modèle de téléphone
    const data = await page.evaluate(() => document.getElementById('model'));
    //traite les données et les pousses dans un tableau
    for(i=1;i<35;i++){
      arrofOpts.push(data[i]._value.split('-')[0])
    }
    
    let arrOfStorage = [];
    //on va se servir des différents modèles pour récupérer les différentes taille de stockage par modèle et les stocker dans un tableau egalement
    arrofOpts.forEach((iphoneModel, index) => {
      try{
        setTimeout(async () =>{ //toutes les secondes on va sur la page qui correspond au modèle d'iphone
          let url = `https://www.backmarket.fr/fr-fr/buyback-funnel/device/telephone/1#brand=1&model=${iphoneModel}`;
          await page.goto(url);
          //ici on recupère les valeurs de stockages
          const modelStorage = await page.evaluate(()=>document.getElementById('storage'));
          let tempsArr = []
          // on pousse les valeurs de stockage dans un tableau et on filtre pour les undefined (modele qui n'ont que 2 valeur de stockage)
          for(j=1;j<4;j++){
            if(modelStorage[j] !== undefined){
              tempsArr.push(modelStorage[j]._value.split(' ')[0])
            }
          }
          arrOfStorage.push(tempsArr);
          // si l'index arrive à 33 on execute la fonction urlsBuilder et on lui passe en param nos 2 tableaux, de modèle et de stockage
          if(index===33){
            urlsBuilder(arrofOpts, arrOfStorage);
          }
        },1000*index)
      } catch (e){
        console.log(e)
      }
    });
  } catch(e){
    console.log(e)
  } 
  //prends un tableau en paramètre 
  const displayData = (arrOfPhones) => {
    //on utilise un reducer pour filtrer les derniers doublons 
    let result = arrOfPhones.reduce((unique, o) => {
      if(!unique.some(obj => obj.name === o.name && obj.price === o.price && obj.screen === o.screen && obj.body === o.body && obj.functionnal === o.functionnal && obj.operator === o.operator)) {
        unique.push(o);
      }
      return unique;
  },[]);
    console.table(result)
  }

  let arrOfPhones = [];
  // avec le tableau d'url on va boucler et récupérer toutes les infos pour tous les modèles d'iphone pour toutes les combinaisons
  const phoneBuilder = async (arr) =>{
    arr.forEach((url,index)=>{
      //on filtre les url qui contiennent undefined
      if(!url.includes('undefined')){
        setTimeout(async ()=>{
          try{
            await page.goto(url);
            //on attend que le bouton soit dispo
            await page.waitForSelector('button[data-qa="submit-section-mobile"]')
            //on click
            await page.click(`button[data-qa="submit-section-mobile"]`);
            //on récupère et on traites nos données
            const name = await page.waitForSelector('span.body-1-bold:nth-of-type(2)');
            const nameValue = await page.evaluate(name => name.textContent,name)
            const sel = 'p.body-1-light';
            const arrOfInfo = await page.evaluate((sel) => {
                                                              let elements = Array.from(document.querySelectorAll(sel));
                                                              let val = elements.map(element => {
                                                              return element.textContent
                                                              })
                                                              return val;
                                                            }, sel);
            //on crée notre phone
            const phone = {
              name:nameValue.cleanup(),
              price:arrOfInfo[0].split('\n')[1].cleanup(),
              screen:arrOfInfo[2].cleanup(),
              body:arrOfInfo[4].cleanup(),
              functionnal:arrOfInfo[6].cleanup(),
              operator:arrOfInfo[8].cleanup()
            }
            //on pousse nos téléphones dans un tableau et on appelle la fonction pour display les données
            arrOfPhones.push(phone);
            displayData(arrOfPhones);
          } catch(e){
            console.log(e)
          }
        },2500*index)
      }
    })
  }
  // fonction qui prends en paramètre 2 tableau, un de modèle et l'autre de stockage
  const urlsBuilder = (models, storages) => {
    //on definit plusieurs variable qui vont nous servir à créer nos urls à scrapper
    const lock = [1,2];
    const body = [1,2,3,4];
    const screen = [1,2,3,4];
    const functionnal = [1,2];
    const arrOfUrls = []
    models.pop()
    //boucle génératrice d'url par combinaison (peut contenir des doublons, traiter plus tard)
    for (n=0;n<models.length;n++){
      let url = 'https://www.backmarket.fr/fr-fr/buyback-funnel/device/telephone/1#brand=1';
        mod = `&model=${models[n]}`
        for (m=0;m<body.length;m++){
             bod = `&state_body=${body[m]}`
            for (l=0;l<screen.length;l++){
                scr = `&state_screen=${screen[l]}`
                for (k=0;k<3;k++){
                    str = `&storage=${storages[n][k]}`
                    for (j=0;j<lock.length;j++){
                         lck = `&sim_lock=${lock[j]}`
                        for (i=0;i<functionnal.length;i++){
                             func = `&state_functional=${functionnal[i]}`
                             arrOfUrls.push(url+mod+bod+scr+str+lck+func)
                        }
                    }
                }
            }
        }
    }
    //appelle la fonction phoneBuilder
    phoneBuilder(arrOfUrls);
  }



})();