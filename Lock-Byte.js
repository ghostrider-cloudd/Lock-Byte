var mode=null;
	var objFile=null;
	switchdiv('encrypt');

	function switchdiv(t) {
		if(t=='encrypt') {
			divEncryptfile.style.display='block';
			divDecryptfile.style.display='none';
			btnDivEncrypt.disabled=true;
			btnDivDecrypt.disabled=false;
			mode='encrypt';
		} else if(t=='decrypt') {
			divEncryptfile.style.display='none';
			divDecryptfile.style.display='block';
			btnDivEncrypt.disabled=false;
			btnDivDecrypt.disabled=true;
			mode='decrypt';
		}
	}

	function encvalidate() {
		if(txtEncpassphrase.value.length>=8 && txtEncpassphrase.value==txtEncpassphraseretype.value) { 
		  spnCheckretype.classList.add("greenspan");
		  spnCheckretype.classList.remove("redspan");
		  spnCheckretype.innerHTML='&#10004;';
		} else { 
		  spnCheckretype.classList.remove("greenspan");
		  spnCheckretype.classList.add("redspan");
  		  spnCheckretype.innerHTML='&#10006;';
		}

		if( txtEncpassphrase.value.length>=8 && txtEncpassphrase.value==txtEncpassphraseretype.value && objFile ) { btnEncrypt.disabled=false; } else { btnEncrypt.disabled=true; }
	}

	function decvalidate() {
		if( txtDecpassphrase.value.length>0 && objFile ) { btnDecrypt.disabled=false; } else { btnDecrypt.disabled=true; }
	}

	
	function drop_handler(ev) {
		console.log("Drop");
		ev.preventDefault();
		
		var dt = ev.dataTransfer;
		if (dt.items) {
			
			for (var i=0; i < dt.items.length; i++) {
				if (dt.items[i].kind == "file") {
					var f = dt.items[i].getAsFile();
					console.log("... file[" + i + "].name = " + f.name);
					objFile=f;
				}
			}
		} else {
			
			for (var i=0; i < dt.files.length; i++) {
				console.log("... file[" + i + "].name = " + dt.files[i].name);
			}  
			objFile=file[0];
		}		 
		displayfile()
		if(mode=='encrypt') { encvalidate(); } else if(mode=='decrypt') { decvalidate(); }
	}

	function dragover_handler(ev) {
		console.log("dragOver");
		
		ev.preventDefault();
	}

	function dragend_handler(ev) {
		console.log("dragEnd");
		
		var dt = ev.dataTransfer;
		if (dt.items) {
			
			for (var i = 0; i < dt.items.length; i++) {
				dt.items.remove(i);
			}
		} else {
		
			ev.dataTransfer.clearData();
		}
	}

	function selectfile(Files) {
		objFile=Files[0];
		displayfile()
		if(mode=='encrypt') { encvalidate(); } 
		else if(mode=='decrypt') { decvalidate(); }
	}

	function displayfile() {
		var s;
		var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		var bytes=objFile.size;
		var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
		if(i==0) { s=bytes + ' ' + sizes[i]; } else { s=(bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]; }

		if(mode=='encrypt') { 
			spnencfilename.textContent=objFile.name + ' (' + s + ')'; 
		} else if(mode=='decrypt') {  
			spndecfilename.textContent=objFile.name + ' (' + s + ')'; 
		} 
	}

	function readfile(file){
		return new Promise((resolve, reject) => {
			var fr = new FileReader();  
			fr.onload = () => {
				resolve(fr.result )
			};
			fr.readAsArrayBuffer(file);
		});
	}

	async function encryptfile() {
		btnEncrypt.disabled=true;

		var plaintextbytes=await readfile(objFile)
		.catch(function(err){
			console.error(err);
		});	
		var plaintextbytes=new Uint8Array(plaintextbytes);

		var pbkdf2iterations=10000;
		var passphrasebytes=new TextEncoder("utf-8").encode(txtEncpassphrase.value);
		var pbkdf2salt=window.crypto.getRandomValues(new Uint8Array(8));

		var passphrasekey=await window.crypto.subtle.importKey('raw', passphrasebytes, {name: 'PBKDF2'}, false, ['deriveBits'])
		.catch(function(err){
			console.error(err);
		});
		console.log('passphrasekey imported');

		var pbkdf2bytes=await window.crypto.subtle.deriveBits({"name": 'PBKDF2', "salt": pbkdf2salt, "iterations": pbkdf2iterations, "hash": 'SHA-256'}, passphrasekey, 384)		
		.catch(function(err){
			console.error(err);
		});
		console.log('pbkdf2bytes derived');
		pbkdf2bytes=new Uint8Array(pbkdf2bytes);

		keybytes=pbkdf2bytes.slice(0,32);
		ivbytes=pbkdf2bytes.slice(32);

		var key=await window.crypto.subtle.importKey('raw', keybytes, {name: 'AES-CBC', length: 256}, false, ['encrypt']) 
		.catch(function(err){
			console.error(err);
		});
		console.log('key imported');		

		var cipherbytes=await window.crypto.subtle.encrypt({name: "AES-CBC", iv: ivbytes}, key, plaintextbytes)
		.catch(function(err){
			console.error(err);
		});

		if(!cipherbytes) {
		 	spnEncstatus.classList.add("redspan");
			spnEncstatus.innerHTML='<p>Error encrypting file.  See console log.</p>';
			return;
		}

		console.log('plaintext encrypted');
		cipherbytes=new Uint8Array(cipherbytes);

		var resultbytes=new Uint8Array(cipherbytes.length+16)
		resultbytes.set(new TextEncoder("utf-8").encode('Salted__'));
		resultbytes.set(pbkdf2salt, 8);
		resultbytes.set(cipherbytes, 16);

		var blob=new Blob([resultbytes], {type: 'application/download'});
		var blobUrl=URL.createObjectURL(blob);
		aEncsavefile.href=blobUrl;
		aEncsavefile.download=objFile.name + '.enc';

	 	spnEncstatus.classList.add("greenspan");
		spnEncstatus.innerHTML='<p>File encrypted.</p>';
		aEncsavefile.hidden=false;
	}

	async function decryptfile() {
		btnDecrypt.disabled=true;

		var cipherbytes=await readfile(objFile)
		.catch(function(err){
			console.error(err);
		});	
		var cipherbytes=new Uint8Array(cipherbytes);

		var pbkdf2iterations=10000;
		var passphrasebytes=new TextEncoder("utf-8").encode(txtDecpassphrase.value);
		var pbkdf2salt=cipherbytes.slice(8,16);


		var passphrasekey=await window.crypto.subtle.importKey('raw', passphrasebytes, {name: 'PBKDF2'}, false, ['deriveBits'])
		.catch(function(err){
			console.error(err);

		});
		console.log('passphrasekey imported');

		var pbkdf2bytes=await window.crypto.subtle.deriveBits({"name": 'PBKDF2', "salt": pbkdf2salt, "iterations": pbkdf2iterations, "hash": 'SHA-256'}, passphrasekey, 384)		
		.catch(function(err){
			console.error(err);
		});
		console.log('pbkdf2bytes derived');
		pbkdf2bytes=new Uint8Array(pbkdf2bytes);

		keybytes=pbkdf2bytes.slice(0,32);
		ivbytes=pbkdf2bytes.slice(32);
		cipherbytes=cipherbytes.slice(16);

		var key=await window.crypto.subtle.importKey('raw', keybytes, {name: 'AES-CBC', length: 256}, false, ['decrypt']) 
		.catch(function(err){
			console.error(err);
		});
		console.log('key imported');		

		var plaintextbytes=await window.crypto.subtle.decrypt({name: "AES-CBC", iv: ivbytes}, key, cipherbytes)
		.catch(function(err){
			console.error(err);
		});

		if(!plaintextbytes) {
		 	spnDecstatus.classList.add("redspan");
			spnDecstatus.innerHTML='<p>Error decrypting file.  Password may be incorrect.</p>';
			return;
		}

		console.log('ciphertext decrypted');
		plaintextbytes=new Uint8Array(plaintextbytes);

		var blob=new Blob([plaintextbytes], {type: 'application/download'});
		var blobUrl=URL.createObjectURL(blob);
		aDecsavefile.href=blobUrl;
		aDecsavefile.download=objFile.name -'enc' ;

	 	spnDecstatus.classList.add("greenspan");
		spnDecstatus.innerHTML='<p>File decrypted.</p>';
		aDecsavefile.hidden=false;
	}